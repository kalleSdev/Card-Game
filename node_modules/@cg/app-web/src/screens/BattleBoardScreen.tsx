/**
 * BattleBoardScreen — Hearthstone-style local combat board.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  Opponent leader + board (top)  │
 *   │  ─────── center info ─────────  │
 *   │  Active player board (bottom)   │
 *   │  Active player hand             │
 *   └─────────────────────────────────┘
 *
 * Interaction:
 *  - Click one of your board cards (or leader) to select it as attacker
 *  - Click an enemy card / the enemy leader to attack
 *  - Click "Cancel" to deselect
 *  - Play hand cards by clicking them (slot auto-assigned to first empty)
 *  - Click "END TURN" to end your turn — triggers a handoff overlay
 *  - Domain button glows when meter hits 100; clicking activates it
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerId } from "@cg/contracts";
import type { BattleState, BattleCard, BattlePlayer, BattleIntent, BattleEvent } from "../battleEngine";
import { createBattleEngine } from "../battleEngine";
import type { PlayerDraftResult } from "./DraftBattleScreen";
import { createBattleState } from "../battleEngine";
import type { CardDef } from "@cg/contracts";

const RARITY_COLOR: Record<string, string> = {
  C: "#aaaaaa", B: "#44bbff", A: "#22ee88", S: "#ffcc00",
  SS: "#ff8800", SSS: "#ff3366", X: "#cc44ff",
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  p1Draft: PlayerDraftResult;
  p2Draft: PlayerDraftResult;
  cardDb: Record<string, CardDef>;
  p1Name: string;
  p2Name: string;
  p1Icon: string;
  p2Icon: string;
  onGameOver: (winner: PlayerId) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card component — shared by board and hand
// ─────────────────────────────────────────────────────────────────────────────

function CardView({
  card, size = "md", selected, targetable, onClick, disabled,
}: {
  card: BattleCard;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  targetable?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const dim = size === "lg" ? 100 : size === "md" ? 78 : 60;
  const rarity = RARITY_COLOR[card.rarity] ?? "#aaa";
  const hpPct  = Math.max(0, Math.min(100, (card.currentHp / card.maxHp) * 100));
  const hpColor = hpPct > 60 ? "#44ff88" : hpPct > 30 ? "#ffcc00" : "#ff4444";

  return (
    <motion.div
      onClick={disabled ? undefined : onClick}
      animate={{
        boxShadow: selected
          ? `0 0 0 3px #ffcc00, 0 0 20px #ffcc0088`
          : targetable
          ? `0 0 0 3px #ff4444, 0 0 20px #ff444488`
          : `0 0 0 1px ${rarity}44`,
        scale: selected ? 1.08 : 1,
      }}
      whileHover={!disabled ? { y: -4, scale: 1.06 } : undefined}
      whileTap={!disabled ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      style={{
        width: dim, minHeight: dim * 1.3,
        background: `linear-gradient(160deg, #0e0e1a, #15121f)`,
        border: `2px solid ${rarity}55`,
        borderRadius: 10,
        cursor: disabled ? "default" : "pointer",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        padding: "6px 4px 5px",
        position: "relative", overflow: "hidden",
        userSelect: "none",
        opacity: card.exhausted && !selected ? 0.6 : 1,
      }}
    >
      {/* Rarity shimmer bar at top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: rarity, opacity: 0.7 }} />

      {/* Stun indicator */}
      {card.stunTurns > 0 && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          background: "#4488ff", borderRadius: 3, fontSize: 7, fontWeight: 900,
          padding: "1px 4px", color: "#fff",
        }}>STUN {card.stunTurns}</div>
      )}

      {/* Name */}
      <div style={{
        fontSize: size === "sm" ? 7 : 8, fontWeight: 700, letterSpacing: 0.5,
        color: "#ddd", textAlign: "center", lineHeight: 1.2,
        maxWidth: "95%", wordBreak: "break-word",
      }}>{card.name}</div>

      {/* ATK / HP row */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "4px 0" }}>
        <div style={{ fontSize: size === "sm" ? 11 : 14, fontWeight: 900, color: "#ff6644" }}>⚔{card.atk}</div>
        <div style={{ fontSize: size === "sm" ? 11 : 14, fontWeight: 900, color: hpColor }}>♥{card.currentHp}</div>
      </div>

      {/* HP bar */}
      <div style={{ width: "90%", height: 3, background: "#111", borderRadius: 2 }}>
        <motion.div
          animate={{ width: `${hpPct}%` }}
          transition={{ duration: 0.3 }}
          style={{ height: "100%", background: hpColor, borderRadius: 2 }}
        />
      </div>

      {/* Exhausted overlay */}
      {card.exhausted && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
          borderRadius: 8, pointerEvents: "none",
        }} />
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Leader display — larger, prominent HP bar
// ─────────────────────────────────────────────────────────────────────────────

function LeaderView({
  leader, flipped, selected, targetable, energy, maxEnergy, domainMeter,
  showDomainBtn, onSelect, onDomainActivate, playerName,
}: {
  leader: BattleCard;
  flipped?: boolean;
  selected?: boolean;
  targetable?: boolean;
  energy?: number;
  maxEnergy?: number;
  domainMeter?: number;
  showDomainBtn?: boolean;
  onSelect?: () => void;
  onDomainActivate?: () => void;
  playerName: string;
}) {
  const rarity  = RARITY_COLOR[leader.rarity] ?? "#aaa";
  const hpPct   = Math.max(0, Math.min(100, (leader.currentHp / leader.maxHp) * 100));
  const hpColor = hpPct > 50 ? "#44ff88" : hpPct > 25 ? "#ffcc00" : "#ff4444";
  const meterFull = (domainMeter ?? 0) >= 100;

  return (
    <div style={{
      display: "flex", flexDirection: flipped ? "column-reverse" : "column",
      alignItems: "center", gap: 6,
    }}>
      <div style={{ fontSize: 9, color: "#888", letterSpacing: 2 }}>{playerName}</div>

      <motion.div
        onClick={onSelect}
        animate={{
          boxShadow: selected
            ? `0 0 0 3px #ffcc00, 0 0 28px #ffcc00aa`
            : targetable
            ? `0 0 0 3px #ff4444, 0 0 28px #ff4444aa`
            : `0 0 0 2px ${rarity}55`,
        }}
        whileHover={onSelect ? { scale: 1.05 } : undefined}
        whileTap={onSelect ? { scale: 0.96 } : undefined}
        style={{
          width: 90, height: 120,
          background: `linear-gradient(160deg, #130d1f, #1a1030)`,
          border: `2px solid ${rarity}66`,
          borderRadius: 12,
          cursor: onSelect ? "pointer" : "default",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "space-between",
          padding: "8px 6px 7px", position: "relative", overflow: "hidden",
          userSelect: "none",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: rarity }} />
        {leader.stunTurns > 0 && (
          <div style={{
            position: "absolute", top: 6, right: 4, background: "#4488ff",
            borderRadius: 3, fontSize: 7, fontWeight: 900, padding: "1px 5px", color: "#fff",
          }}>STUN {leader.stunTurns}</div>
        )}
        <div style={{ fontSize: 9, fontWeight: 800, color: "#eee", textAlign: "center", letterSpacing: 0.5 }}>
          {leader.name}
        </div>
        <div style={{ fontSize: 11, color: "#aaa", letterSpacing: 1 }}>LEADER</div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: "#ff6644" }}>⚔{leader.atk}</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: hpColor }}>♥{leader.currentHp}</span>
        </div>
        <div style={{ width: "86%", height: 4, background: "#111", borderRadius: 2 }}>
          <motion.div
            animate={{ width: `${hpPct}%` }}
            transition={{ duration: 0.35 }}
            style={{ height: "100%", background: hpColor, borderRadius: 2 }}
          />
        </div>
      </motion.div>

      {/* Energy + Domain (active player only) */}
      {energy !== undefined && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: maxEnergy ?? 0 }).map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%",
                background: i < (energy ?? 0) ? "#4ae" : "#222",
                border: "1px solid #335",
                boxShadow: i < (energy ?? 0) ? "0 0 6px #4aeeff88" : "none",
              }} />
            ))}
          </div>
          <div style={{ fontSize: 8, color: "#556", letterSpacing: 1 }}>{energy}/{maxEnergy} ENERGY</div>

          {/* Domain meter */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: 80, height: 5, background: "#111", borderRadius: 3, overflow: "hidden" }}>
              <motion.div
                animate={{ width: `${domainMeter ?? 0}%` }}
                transition={{ duration: 0.4 }}
                style={{
                  height: "100%",
                  background: meterFull
                    ? "linear-gradient(90deg, #cc44ff, #ff44cc)"
                    : "linear-gradient(90deg, #5522aa, #8833dd)",
                  borderRadius: 3,
                  boxShadow: meterFull ? "0 0 8px #cc44ffaa" : "none",
                }}
              />
            </div>
            <div style={{ fontSize: 7, color: meterFull ? "#cc44ff" : "#444", letterSpacing: 1 }}>
              DOMAIN {domainMeter ?? 0}/100
            </div>
            {showDomainBtn && meterFull && (
              <motion.button
                onClick={onDomainActivate}
                animate={{ boxShadow: ["0 0 12px #cc44ff88", "0 0 24px #cc44ffcc", "0 0 12px #cc44ff88"] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{
                  background: "linear-gradient(135deg, #4a0080, #8800cc)",
                  border: "2px solid #cc44ff",
                  borderRadius: 8, color: "#fff", fontSize: 9,
                  fontWeight: 900, letterSpacing: 2, padding: "4px 12px",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >EXPAND DOMAIN</motion.button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Board row — 5 slots
// ─────────────────────────────────────────────────────────────────────────────

function BoardRow({
  board, pendingId, targeting, myBoard,
  onSelectCard, onTargetCard,
}: {
  board: (BattleCard | null)[];
  pendingId: string | null;
  targeting: boolean;
  myBoard: boolean;
  onSelectCard?: (id: string) => void;
  onTargetCard?: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-end", minHeight: 110 }}>
      {board.map((card, i) => (
        <div key={i} style={{ width: 78 }}>
          {card ? (
            <CardView
              card={card}
              selected={pendingId === card.instanceId}
              targetable={targeting && !myBoard}
              onClick={() => {
                if (myBoard && onSelectCard) onSelectCard(card.instanceId);
                else if (!myBoard && onTargetCard) onTargetCard(card.instanceId);
              }}
              disabled={myBoard && card.exhausted && pendingId !== card.instanceId}
            />
          ) : (
            <div style={{
              width: 78, height: 101,
              border: "1px dashed #1a1a28", borderRadius: 10,
              background: "rgba(255,255,255,0.015)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hand row
// ─────────────────────────────────────────────────────────────────────────────

function HandRow({
  hand, energy, costReduction, onPlay,
}: {
  hand: BattleCard[];
  energy: number;
  costReduction: number;
  onPlay: (id: string) => void;
}) {
  return (
    <div style={{
      display: "flex", gap: 8, justifyContent: "center",
      padding: "10px 20px", overflowX: "auto",
      background: "rgba(0,0,0,0.35)", borderTop: "1px solid #1a1a2e",
      minHeight: 110,
    }}>
      {hand.map(card => {
        const cost = Math.max(0, card.cost - costReduction);
        const canAfford = energy >= cost;
        return (
          <div key={card.instanceId} style={{ position: "relative", flexShrink: 0 }}>
            <CardView
              card={card}
              size="md"
              onClick={() => canAfford && onPlay(card.instanceId)}
              disabled={!canAfford}
            />
            <div style={{
              position: "absolute", top: -6, right: -6,
              width: 20, height: 20, borderRadius: "50%",
              background: canAfford ? "#4ae" : "#333",
              border: `2px solid ${canAfford ? "#4aeecc" : "#444"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 900, color: canAfford ? "#000" : "#666",
              boxShadow: canAfford ? "0 0 8px #4aeecc88" : "none",
            }}>{cost}</div>
          </div>
        );
      })}
      {hand.length === 0 && (
        <div style={{ color: "#333", fontSize: 10, letterSpacing: 2, alignSelf: "center" }}>NO CARDS IN HAND</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Handoff overlay — shown between turns
// ─────────────────────────────────────────────────────────────────────────────

function HandoffOverlay({ name, onReady }: { name: string; onReady: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(2,2,10,0.96)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 24,
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        style={{ textAlign: "center" }}
      >
        <div style={{ fontSize: 12, letterSpacing: 6, color: "#556", marginBottom: 12 }}>TURN END</div>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 4, color: "#fff" }}>
          PASS TO
        </div>
        <div style={{ fontSize: 42, fontWeight: 900, color: "#ffcc00", letterSpacing: 2, marginTop: 8 }}>
          {name}
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ fontSize: 10, color: "#445", letterSpacing: 3 }}
      >
        COVER YOUR SCREEN, THEN CONTINUE
      </motion.div>

      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.55 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onReady}
        style={{
          marginTop: 8,
          padding: "14px 48px",
          background: "linear-gradient(135deg, #1a1a3a, #2a1a4a)",
          border: "2px solid #4a4a7a",
          borderRadius: 12, color: "#aaa",
          fontSize: 13, fontWeight: 900, letterSpacing: 4,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        I'M READY →
      </motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain activation flash
// ─────────────────────────────────────────────────────────────────────────────

function DomainFlash({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2, times: [0, 0.1, 0.85, 1] }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "radial-gradient(ellipse at center, #6600cc44 0%, #1100330a 60%, transparent 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.2, 1], opacity: [0, 1, 1] }}
        transition={{ duration: 0.5, ease: "backOut" }}
        style={{ textAlign: "center" }}
      >
        <div style={{ fontSize: 10, letterSpacing: 8, color: "#cc44ff", marginBottom: 8 }}>DOMAIN EXPANSION</div>
        <div style={{
          fontSize: 38, fontWeight: 900, letterSpacing: 3,
          color: "#fff",
          textShadow: "0 0 40px #cc44ffcc, 0 0 80px #8800aa88",
        }}>{name}</div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game over overlay
// ─────────────────────────────────────────────────────────────────────────────

function GameOverOverlay({ winner, winnerName, onDone }: { winner: PlayerId; winnerName: string; onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(2,2,10,0.92)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.6, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
        style={{ textAlign: "center" }}
      >
        <div style={{ fontSize: 11, letterSpacing: 8, color: "#666", marginBottom: 12 }}>BATTLE OVER</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#ffcc00", letterSpacing: 3,
          textShadow: "0 0 40px #ffcc0066" }}>
          {winnerName}
        </div>
        <div style={{ fontSize: 14, letterSpacing: 6, color: "#aaa", marginTop: 8 }}>WINS</div>
      </motion.div>
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onDone}
        style={{
          padding: "14px 48px",
          background: "linear-gradient(135deg, #2a1a00, #4a3000)",
          border: "2px solid #ffcc0088",
          borderRadius: 12, color: "#ffcc00",
          fontSize: 13, fontWeight: 900, letterSpacing: 4,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >CONTINUE</motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function BattleBoardScreen({
  p1Draft, p2Draft, cardDb,
  p1Name, p2Name,
  onGameOver,
}: Props) {
  const [engine] = useState(() =>
    createBattleEngine(createBattleState(p1Draft, p2Draft, cardDb))
  );
  const [battleState, setBattleState] = useState<BattleState>(() => engine.getState());
  const [showHandoff, setShowHandoff] = useState<{ pid: PlayerId; name: string } | null>(null);
  const [domainFlash, setDomainFlash] = useState<string | null>(null);
  const [gameOverShown, setGameOverShown] = useState(false);

  const dispatch = useCallback((intent: BattleIntent) => {
    const result = engine.apply(intent);
    setBattleState(result.state);

    for (const ev of result.events) {
      if (ev.type === "DOMAIN_ACTIVATED") {
        setDomainFlash(ev.name);
      }
      if (ev.type === "GAME_OVER") {
        setGameOverShown(true);
        return;
      }
    }
  }, [engine]);

  // Process initial DRAW phase on mount
  useEffect(() => {
    if (battleState.phase === "DRAW") {
      dispatch({ type: "END_TURN", pid: battleState.activePlayer });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndTurn = () => {
    const pid = battleState.activePlayer;
    dispatch({ type: "END_TURN", pid });
    const nextPid = pid === "P1" ? "P2" : "P1";
    const nextName = nextPid === "P1" ? p1Name : p2Name;
    setShowHandoff({ pid: nextPid, name: nextName });
  };

  const handleReadyAfterHandoff = () => setShowHandoff(null);

  const handlePlayCard = (instanceId: string) => {
    const pid = battleState.activePlayer;
    const player = battleState.players[pid];
    // Find first empty board slot
    const slot = player.board.findIndex(s => s === null);
    if (slot === -1) return; // board full
    dispatch({ type: "PLAY_CARD", pid, instanceId, slot });
  };

  const handleSelectAttacker = (instanceId: string) => {
    const pid = battleState.activePlayer;
    if (battleState.pendingAttackerId === instanceId) {
      dispatch({ type: "CANCEL_ATTACK", pid });
    } else {
      dispatch({ type: "SELECT_ATTACKER", pid, instanceId });
    }
  };

  const handleTargetCard = (instanceId: string) => {
    const pid = battleState.activePlayer;
    if (!battleState.pendingAttackerId) return;
    dispatch({ type: "ATTACK_CARD", pid, targetInstanceId: instanceId });
  };

  const handleTargetLeader = () => {
    const pid = battleState.activePlayer;
    if (!battleState.pendingAttackerId) return;
    dispatch({ type: "ATTACK_LEADER", pid });
  };

  const handleDomain = () => {
    const pid = battleState.activePlayer;
    dispatch({ type: "ACTIVATE_DOMAIN", pid });
  };

  if (!battleState || battleState.phase === "DRAW") return (
    <div style={{ background: "#04040a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#556", letterSpacing: 4, fontSize: 12 }}>PREPARING BOARD…</div>
    </div>
  );

  const pid    = battleState.activePlayer;
  const oppId  = pid === "P1" ? "P2" : "P1";
  const player: BattlePlayer = battleState.players[pid];
  const opp:    BattlePlayer = battleState.players[oppId];
  const name    = pid === "P1" ? p1Name : p2Name;
  const oppName = pid === "P1" ? p2Name : p1Name;
  const targeting = battleState.pendingAttackerId !== null;

  const winnerName = battleState.winner
    ? battleState.winner === "P1" ? p1Name : p2Name
    : "";

  return (
    <div style={{
      minHeight: "100vh", maxHeight: "100vh",
      background: "linear-gradient(180deg, #02020a 0%, #05030f 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: "hidden", position: "relative",
    }}>
      {/* Board grid lines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, transparent, transparent 49px, #0a0a1a 50px)",
        opacity: 0.4,
      }} />

      {/* ── OPPONENT AREA (top) ─────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "14px 20px 8px", gap: 20,
        borderBottom: "1px solid #0d0d20",
        position: "relative",
      }}>
        {/* Opponent label */}
        <div style={{
          position: "absolute", top: 8, left: 16,
          fontSize: 9, letterSpacing: 3, color: "#334",
        }}>OPPONENT</div>

        <LeaderView
          leader={opp.leader}
          flipped
          targetable={targeting}
          playerName={oppName}
          onSelect={targeting ? handleTargetLeader : undefined}
        />

        <BoardRow
          board={opp.board}
          pendingId={null}
          targeting={targeting}
          myBoard={false}
          onTargetCard={handleTargetCard}
        />
      </div>

      {/* ── CENTER INFO BAR ─────────────────────────────────────────────── */}
      <div style={{
        padding: "8px 24px",
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid #0d0d20", borderBottom: "1px solid #0d0d20",
      }}>
        {/* Turn + active player */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 9, color: "#334", letterSpacing: 3 }}>TURN {battleState.turn}</div>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 2,
            color: pid === "P1" ? "#4a9eff" : "#ff6666",
            background: pid === "P1" ? "rgba(74,158,255,0.08)" : "rgba(255,102,102,0.08)",
            padding: "3px 10px", borderRadius: 6,
            border: `1px solid ${pid === "P1" ? "#4a9eff44" : "#ff666644"}`,
          }}>{name}'s TURN</div>
        </div>

        {/* Synergies */}
        {player.activeSynergies.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
            {player.activeSynergies.slice(0, 3).map(id => (
              <div key={id} style={{
                fontSize: 7, padding: "2px 6px", borderRadius: 4,
                background: "rgba(255,200,50,0.1)", border: "1px solid #ffcc0055",
                color: "#ffcc00", letterSpacing: 1,
              }}>{id.replace(/_/g, " ").toUpperCase()}</div>
            ))}
          </div>
        )}

        {/* End turn / cancel */}
        <div style={{ display: "flex", gap: 8 }}>
          {targeting && (
            <motion.button
              onClick={() => dispatch({ type: "CANCEL_ATTACK", pid })}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: "8px 16px",
                background: "rgba(255,100,50,0.08)", border: "1px solid #ff644444",
                borderRadius: 8, color: "#ff6444", fontSize: 9, fontWeight: 800,
                letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
              }}
            >CANCEL</motion.button>
          )}
          <motion.button
            onClick={handleEndTurn}
            whileHover={{ scale: 1.05, boxShadow: "0 0 20px #44ff8844" }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: "8px 20px",
              background: "linear-gradient(135deg, #0a2a10, #0d3a15)",
              border: "1px solid #44ff8844",
              borderRadius: 8, color: "#44ff88", fontSize: 10, fontWeight: 900,
              letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
            }}
          >END TURN →</motion.button>
        </div>
      </div>

      {/* ── ACTIVE PLAYER BOARD ─────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "8px 20px 10px", gap: 20,
        position: "relative",
      }}>
        <div style={{
          position: "absolute", bottom: 8, left: 16,
          fontSize: 9, letterSpacing: 3, color: "#334",
        }}>YOUR BOARD</div>

        <LeaderView
          leader={player.leader}
          selected={battleState.pendingAttackerId === player.leader.instanceId}
          energy={player.energy}
          maxEnergy={player.maxEnergy}
          domainMeter={player.domainMeter}
          showDomainBtn
          playerName={name}
          onSelect={() => handleSelectAttacker(player.leader.instanceId)}
          onDomainActivate={handleDomain}
        />

        <BoardRow
          board={player.board}
          pendingId={battleState.pendingAttackerId}
          targeting={false}
          myBoard
          onSelectCard={handleSelectAttacker}
        />
      </div>

      {/* ── HAND ────────────────────────────────────────────────────────── */}
      <HandRow
        hand={player.hand}
        energy={player.energy}
        costReduction={player.costReduction}
        onPlay={handlePlayCard}
      />

      {/* ── Overlays ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHandoff && (
          <HandoffOverlay
            key="handoff"
            name={showHandoff.name}
            onReady={handleReadyAfterHandoff}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {domainFlash && (
          <DomainFlash
            key="domain"
            name={domainFlash}
            onDone={() => setDomainFlash(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameOverShown && battleState.winner && (
          <GameOverOverlay
            key="gameover"
            winner={battleState.winner}
            winnerName={winnerName}
            onDone={() => onGameOver(battleState.winner!)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
