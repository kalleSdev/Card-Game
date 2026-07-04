/**
 * BattleBoardScreen — Hearthstone-style local combat board.
 *
 * Cards are rendered with the full CharacterCard component (real art + rarity effects).
 * Battle stats (ATK / HP / cost) are overlaid on each card as translucent bars.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  Opponent leader + board (top)  │
 *   │  ─────── center info ─────────  │
 *   │  Active player board (bottom)   │
 *   │  Active player hand             │
 *   └─────────────────────────────────┘
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerId, CardDef } from "@cg/contracts";
import type { BattleState, BattleCard, BattlePlayer, BattleIntent } from "../battleEngine";
import { createBattleEngine, createBattleState } from "../battleEngine";
import type { PlayerDraftResult } from "./DraftBattleScreen";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";

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
// BoardCardView — CharacterCard with battle-stat overlay
// ─────────────────────────────────────────────────────────────────────────────

function BoardCardView({
  card, cardDb, selected, targetable, onClick, flipped,
}: {
  card: BattleCard;
  cardDb: Record<string, CardDef>;
  selected?: boolean;
  targetable?: boolean;
  onClick?: () => void;
  flipped?: boolean;
}) {
  const def = cardDb[card.defId];
  const hpPct   = Math.max(0, Math.min(100, (card.currentHp / card.maxHp) * 100));
  const hpColor = hpPct > 60 ? "#44ff88" : hpPct > 30 ? "#ffcc00" : "#ff4444";

  return (
    <motion.div
      onClick={onClick}
      animate={{
        scale: selected ? 1.08 : 1,
        filter: targetable ? "brightness(1.15)" : card.exhausted ? "brightness(0.6) saturate(0.5)" : "brightness(1)",
      }}
      whileHover={onClick ? { y: -6, scale: selected ? 1.1 : 1.06 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      style={{
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        transform: flipped ? "scaleY(-1)" : undefined,
      }}
    >
      <CharacterCard defId={card.defId} def={def} size="xs" noHover />

      {/* ATK / HP stat bar over bottom of card */}
      <div style={{
        position: "absolute", bottom: 22, left: 0, right: 0,
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "2px 4px",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(2px)",
        transform: flipped ? "scaleY(-1)" : undefined,
      }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: "#ff7755" }}>⚔{card.atk}</span>
        <span style={{ fontSize: 10, fontWeight: 900, color: hpColor }}>♥{card.currentHp}</span>
      </div>

      {/* HP bar at very bottom */}
      <div style={{
        position: "absolute", bottom: 2, left: 4, right: 4, height: 3,
        background: "#111", borderRadius: 2,
        transform: flipped ? "scaleY(-1)" : undefined,
      }}>
        <motion.div
          animate={{ width: `${hpPct}%` }}
          transition={{ duration: 0.3 }}
          style={{ height: "100%", background: hpColor, borderRadius: 2 }}
        />
      </div>

      {/* Stun badge */}
      {card.stunTurns > 0 && (
        <div style={{
          position: "absolute", top: 4, left: 4,
          background: "#4488ff", borderRadius: 3,
          fontSize: 7, fontWeight: 900, padding: "1px 4px", color: "#fff",
          transform: flipped ? "scaleY(-1)" : undefined,
        }}>STUN {card.stunTurns}</div>
      )}

      {/* Selection ring (yellow = attacker selected) */}
      {selected && (
        <motion.div
          animate={{ boxShadow: ["0 0 0 3px #ffcc00, 0 0 16px #ffcc0088", "0 0 0 3px #ffcc00, 0 0 28px #ffcc00cc"] }}
          transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
          style={{ position: "absolute", inset: -2, borderRadius: 12, pointerEvents: "none" }}
        />
      )}

      {/* Target ring (red = attackable) */}
      {targetable && !selected && (
        <motion.div
          animate={{ boxShadow: ["0 0 0 3px #ff4444, 0 0 14px #ff444488", "0 0 0 3px #ff6666, 0 0 22px #ff4444cc"] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          style={{ position: "absolute", inset: -2, borderRadius: 12, pointerEvents: "none" }}
        />
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HandCardView — CharacterCard with cost badge + stat strip
// ─────────────────────────────────────────────────────────────────────────────

function HandCardView({
  card, cardDb, energy, costReduction, onPlay,
}: {
  card: BattleCard;
  cardDb: Record<string, CardDef>;
  energy: number;
  costReduction: number;
  onPlay: () => void;
}) {
  const def = cardDb[card.defId];
  const cost = Math.max(0, card.cost - costReduction);
  const canAfford = energy >= cost;
  const hpPct   = Math.max(0, Math.min(100, (card.currentHp / card.maxHp) * 100));
  const hpColor = hpPct > 60 ? "#44ff88" : hpPct > 30 ? "#ffcc00" : "#ff4444";

  return (
    <motion.div
      onClick={canAfford ? onPlay : undefined}
      whileHover={canAfford ? { y: -10, scale: 1.08 } : { y: -2 }}
      whileTap={canAfford ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      style={{
        position: "relative",
        cursor: canAfford ? "pointer" : "not-allowed",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <CharacterCard defId={card.defId} def={def} size="s" noHover dimmed={!canAfford} />

      {/* Cost badge top-right */}
      <div style={{
        position: "absolute", top: -8, right: -8,
        width: 22, height: 22, borderRadius: "50%",
        background: canAfford ? "#4ae" : "#333",
        border: `2px solid ${canAfford ? "#4aeecc" : "#444"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 900, color: canAfford ? "#000" : "#666",
        boxShadow: canAfford ? "0 0 8px #4aeecc88" : "none",
      }}>{cost}</div>

      {/* ATK/HP overlay */}
      <div style={{
        position: "absolute", bottom: 22, left: 0, right: 0,
        display: "flex", justifyContent: "space-around",
        padding: "2px 4px",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(2px)",
      }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: "#ff7755" }}>⚔{card.atk}</span>
        <span style={{ fontSize: 10, fontWeight: 900, color: hpColor }}>♥{card.currentHp}</span>
      </div>

      {/* HP bar */}
      <div style={{ position: "absolute", bottom: 2, left: 4, right: 4, height: 3, background: "#111", borderRadius: 2 }}>
        <motion.div
          animate={{ width: `${hpPct}%` }}
          transition={{ duration: 0.3 }}
          style={{ height: "100%", background: hpColor, borderRadius: 2 }}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LeaderView — uses PlayerIcon for avatar, card art for the leader card
// ─────────────────────────────────────────────────────────────────────────────

function LeaderView({
  leader, cardDb, playerName, playerIcon,
  flipped, selected, targetable, energy, maxEnergy,
  domainMeter, showDomainBtn,
  onSelect, onDomainActivate,
}: {
  leader: BattleCard;
  cardDb: Record<string, CardDef>;
  playerName: string;
  playerIcon: string;
  flipped?: boolean;
  selected?: boolean;
  targetable?: boolean;
  energy?: number;
  maxEnergy?: number;
  domainMeter?: number;
  showDomainBtn?: boolean;
  onSelect?: () => void;
  onDomainActivate?: () => void;
}) {
  const def = cardDb[leader.defId];
  const hpPct   = Math.max(0, Math.min(100, (leader.currentHp / leader.maxHp) * 100));
  const hpColor = hpPct > 50 ? "#44ff88" : hpPct > 25 ? "#ffcc00" : "#ff4444";
  const meterFull = (domainMeter ?? 0) >= 100;

  return (
    <div style={{
      display: "flex", flexDirection: flipped ? "column-reverse" : "column",
      alignItems: "center", gap: 6, flexShrink: 0,
    }}>
      {/* Player name + icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
          <PlayerIcon icon={playerIcon} size={20} style={{ display: "block" }} />
        </div>
        <span style={{ fontSize: 9, color: "#888", letterSpacing: 1 }}>{playerName}</span>
      </div>

      {/* Leader card with overlays */}
      <motion.div
        onClick={onSelect}
        whileHover={onSelect ? { scale: 1.05, y: -4 } : undefined}
        whileTap={onSelect ? { scale: 0.96 } : undefined}
        style={{
          position: "relative", cursor: onSelect ? "pointer" : "default",
          userSelect: "none",
          transform: flipped ? "scaleY(-1)" : undefined,
        }}
      >
        <CharacterCard defId={leader.defId} def={def} size="sm" noHover />

        {/* Stat overlay */}
        <div style={{
          position: "absolute", bottom: 26, left: 0, right: 0,
          display: "flex", justifyContent: "space-around", padding: "2px 4px",
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(2px)",
          transform: flipped ? "scaleY(-1)" : undefined,
        }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: "#ff7755" }}>⚔{leader.atk}</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: hpColor }}>♥{leader.currentHp}</span>
        </div>

        {/* HP bar */}
        <div style={{
          position: "absolute", bottom: 2, left: 4, right: 4, height: 4,
          background: "#111", borderRadius: 2,
          transform: flipped ? "scaleY(-1)" : undefined,
        }}>
          <motion.div
            animate={{ width: `${hpPct}%` }}
            transition={{ duration: 0.35 }}
            style={{ height: "100%", background: hpColor, borderRadius: 2 }}
          />
        </div>

        {/* LEADER badge */}
        <div style={{
          position: "absolute", top: 4, left: 4,
          fontSize: 7, fontWeight: 900, letterSpacing: 1,
          background: "rgba(255,200,0,0.85)", color: "#000",
          padding: "1px 5px", borderRadius: 3,
          transform: flipped ? "scaleY(-1)" : undefined,
        }}>LEADER</div>

        {/* Selection/target rings */}
        {selected && (
          <motion.div
            animate={{ boxShadow: ["0 0 0 3px #ffcc00, 0 0 20px #ffcc0099", "0 0 0 3px #ffcc00, 0 0 32px #ffcc00cc"] }}
            transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
            style={{ position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none" }}
          />
        )}
        {targetable && !selected && (
          <motion.div
            animate={{ boxShadow: ["0 0 0 3px #ff4444, 0 0 18px #ff444488", "0 0 0 3px #ff6666, 0 0 28px #ff4444cc"] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
            style={{ position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none" }}
          />
        )}

        {/* Stun */}
        {leader.stunTurns > 0 && (
          <div style={{
            position: "absolute", top: 4, right: 4,
            background: "#4488ff", borderRadius: 3,
            fontSize: 7, fontWeight: 900, padding: "1px 4px", color: "#fff",
            transform: flipped ? "scaleY(-1)" : undefined,
          }}>STUN</div>
        )}
      </motion.div>

      {/* Energy + domain (active player only) */}
      {energy !== undefined && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {/* Energy crystals */}
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxWidth: 110, justifyContent: "center" }}>
            {Array.from({ length: maxEnergy ?? 0 }).map((_, i) => (
              <div key={i} style={{
                width: 9, height: 9, borderRadius: "50%",
                background: i < (energy ?? 0) ? "#4ae" : "#222",
                border: "1px solid #335",
                boxShadow: i < (energy ?? 0) ? "0 0 5px #4aeecc88" : "none",
              }} />
            ))}
          </div>
          <div style={{ fontSize: 8, color: "#556", letterSpacing: 1 }}>{energy}/{maxEnergy} ENERGY</div>

          {/* Domain meter */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ width: 90, height: 5, background: "#111", borderRadius: 3, overflow: "hidden" }}>
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
                animate={{ boxShadow: ["0 0 10px #cc44ff88", "0 0 22px #cc44ffcc", "0 0 10px #cc44ff88"] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{
                  background: "linear-gradient(135deg, #4a0080, #8800cc)",
                  border: "2px solid #cc44ff",
                  borderRadius: 8, color: "#fff", fontSize: 8,
                  fontWeight: 900, letterSpacing: 2, padding: "4px 10px",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >DOMAIN</motion.button>
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
  board, cardDb, pendingId, targeting, myBoard, flipped,
  onSelectCard, onTargetCard,
}: {
  board: (BattleCard | null)[];
  cardDb: Record<string, CardDef>;
  pendingId: string | null;
  targeting: boolean;
  myBoard: boolean;
  flipped?: boolean;
  onSelectCard?: (id: string) => void;
  onTargetCard?: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "flex-end", minHeight: 115 }}>
      {board.map((card, i) => (
        <div key={i} style={{ width: 72 }}>
          {card ? (
            <BoardCardView
              card={card}
              cardDb={cardDb}
              selected={pendingId === card.instanceId}
              targetable={targeting && !myBoard}
              flipped={flipped}
              onClick={() => {
                if (myBoard && onSelectCard) onSelectCard(card.instanceId);
                else if (!myBoard && onTargetCard) onTargetCard(card.instanceId);
              }}
            />
          ) : (
            <div style={{
              width: 72, height: 103,
              border: "1px dashed #1a1a2a", borderRadius: 10,
              background: "rgba(255,255,255,0.01)",
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
  hand, cardDb, energy, costReduction, onPlay,
}: {
  hand: BattleCard[];
  cardDb: Record<string, CardDef>;
  energy: number;
  costReduction: number;
  onPlay: (id: string) => void;
}) {
  return (
    <div style={{
      display: "flex", gap: 10, justifyContent: "center",
      padding: "12px 24px", overflowX: "auto",
      background: "rgba(0,0,0,0.45)", borderTop: "1px solid #141428",
      minHeight: 145,
    }}>
      {hand.map(card => (
        <HandCardView
          key={card.instanceId}
          card={card}
          cardDb={cardDb}
          energy={energy}
          costReduction={costReduction}
          onPlay={() => onPlay(card.instanceId)}
        />
      ))}
      {hand.length === 0 && (
        <div style={{ color: "#333", fontSize: 10, letterSpacing: 2, alignSelf: "center" }}>
          NO CARDS IN HAND
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Handoff overlay
// ─────────────────────────────────────────────────────────────────────────────

function HandoffOverlay({ name, icon, onReady }: { name: string; icon: string; onReady: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(2,2,10,0.97)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 24,
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
      >
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#445", marginBottom: 4 }}>TURN END</div>
        <motion.div
          animate={{ boxShadow: ["0 0 24px #ffcc0044", "0 0 40px #ffcc0088", "0 0 24px #ffcc0044"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ borderRadius: "50%", overflow: "hidden", border: "3px solid #ffcc0066" }}
        >
          <PlayerIcon icon={icon} size={72} style={{ display: "block" }} />
        </motion.div>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 4, color: "#fff" }}>
          PASS TO
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#ffcc00", letterSpacing: 2 }}>
          {name}
        </div>
        <div style={{ fontSize: 9, color: "#445", letterSpacing: 3, marginTop: 4 }}>
          COVER YOUR SCREEN, THEN CONTINUE
        </div>
      </motion.div>

      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.55 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onReady}
        style={{
          padding: "14px 48px",
          background: "linear-gradient(135deg, #1a1a3a, #2a1a4a)",
          border: "2px solid #4a4a7a",
          borderRadius: 12, color: "#aaa",
          fontSize: 13, fontWeight: 900, letterSpacing: 4,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >I'M READY →</motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain activation flash
// ─────────────────────────────────────────────────────────────────────────────

function DomainFlash({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.2, times: [0, 0.08, 0.85, 1] }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "radial-gradient(ellipse at center, #6600cc44 0%, transparent 70%)",
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
        <div style={{ fontSize: 10, letterSpacing: 8, color: "#cc44ff", marginBottom: 8 }}>
          DOMAIN EXPANSION
        </div>
        <div style={{
          fontSize: 38, fontWeight: 900, letterSpacing: 3, color: "#fff",
          textShadow: "0 0 40px #cc44ffcc, 0 0 80px #8800aa88",
        }}>{name}</div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game over overlay
// ─────────────────────────────────────────────────────────────────────────────

function GameOverOverlay({ winnerName, winnerIcon, onDone }: {
  winnerName: string; winnerIcon: string; onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(2,2,10,0.93)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.6, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
        style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
      >
        <div style={{ fontSize: 11, letterSpacing: 8, color: "#555", marginBottom: 4 }}>BATTLE OVER</div>
        <motion.div
          animate={{ boxShadow: ["0 0 24px #ffcc0055", "0 0 48px #ffcc0099", "0 0 24px #ffcc0055"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ borderRadius: "50%", overflow: "hidden", border: "3px solid #ffcc00" }}
        >
          <PlayerIcon icon={winnerIcon} size={80} style={{ display: "block" }} />
        </motion.div>
        <div style={{
          fontSize: 48, fontWeight: 900, color: "#ffcc00", letterSpacing: 3,
          textShadow: "0 0 40px #ffcc0066",
        }}>{winnerName}</div>
        <div style={{ fontSize: 14, letterSpacing: 6, color: "#aaa" }}>WINS</div>
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
  p1Name, p2Name, p1Icon, p2Icon,
  onGameOver,
}: Props) {
  const [engine] = useState(() =>
    createBattleEngine(createBattleState(p1Draft, p2Draft, cardDb))
  );
  const [battleState, setBattleState] = useState<BattleState>(() => engine.getState());
  const [showHandoff, setShowHandoff] = useState<{ pid: PlayerId; name: string; icon: string } | null>(null);
  const [domainFlash, setDomainFlash] = useState<string | null>(null);
  const [gameOverShown, setGameOverShown] = useState(false);

  const dispatch = useCallback((intent: BattleIntent) => {
    const result = engine.apply(intent);
    setBattleState(result.state);
    for (const ev of result.events) {
      if (ev.type === "DOMAIN_ACTIVATED") setDomainFlash(ev.name);
      if (ev.type === "GAME_OVER") { setGameOverShown(true); return; }
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
    const nextPid: PlayerId = pid === "P1" ? "P2" : "P1";
    setShowHandoff({
      pid: nextPid,
      name: nextPid === "P1" ? p1Name : p2Name,
      icon: nextPid === "P1" ? p1Icon : p2Icon,
    });
  };

  const handlePlayCard = (instanceId: string) => {
    const pid = battleState.activePlayer;
    const player = battleState.players[pid];
    const slot = player.board.findIndex(s => s === null);
    if (slot === -1) return;
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

  if (!battleState || battleState.phase === "DRAW") {
    return (
      <div style={{
        background: "#04040a", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "#556", letterSpacing: 4, fontSize: 12 }}>PREPARING BOARD…</div>
      </div>
    );
  }

  const pid   = battleState.activePlayer;
  const oppId: PlayerId = pid === "P1" ? "P2" : "P1";
  const player: BattlePlayer = battleState.players[pid];
  const opp:   BattlePlayer = battleState.players[oppId];
  const name    = pid === "P1" ? p1Name : p2Name;
  const icon    = pid === "P1" ? p1Icon : p2Icon;
  const oppName = pid === "P1" ? p2Name : p1Name;
  const oppIcon = pid === "P1" ? p2Icon : p1Icon;
  const targeting = battleState.pendingAttackerId !== null;

  const winnerIcon = battleState.winner
    ? battleState.winner === "P1" ? p1Icon : p2Icon
    : "";
  const winnerName = battleState.winner
    ? battleState.winner === "P1" ? p1Name : p2Name
    : "";

  return (
    <div style={{
      minHeight: "100vh", maxHeight: "100vh",
      background: "linear-gradient(180deg, #02020a 0%, #050310 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: "hidden", position: "relative",
    }}>
      {/* Subtle grid overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "repeating-linear-gradient(0deg,transparent,transparent 49px,#0a0a1a 50px)",
        opacity: 0.35,
      }} />

      {/* ── OPPONENT AREA ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "12px 16px 6px", gap: 16,
        borderBottom: "1px solid #0d0d20", position: "relative", zIndex: 1,
      }}>
        <div style={{ position: "absolute", top: 6, left: 14, fontSize: 9, letterSpacing: 3, color: "#2a2a38" }}>
          OPPONENT
        </div>
        <LeaderView
          leader={opp.leader}
          cardDb={cardDb}
          playerName={oppName}
          playerIcon={oppIcon}
          flipped
          targetable={targeting}
          onSelect={targeting ? handleTargetLeader : undefined}
        />
        <BoardRow
          board={opp.board}
          cardDb={cardDb}
          pendingId={null}
          targeting={targeting}
          myBoard={false}
          flipped
          onTargetCard={handleTargetCard}
        />
      </div>

      {/* ── CENTER INFO BAR ──────────────────────────────────────────────── */}
      <div style={{
        padding: "7px 20px", zIndex: 1,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid #0d0d1e", borderBottom: "1px solid #0d0d1e",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 9, color: "#2a2a38", letterSpacing: 3 }}>TURN {battleState.turn}</div>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 2,
            color: pid === "P1" ? "#4a9eff" : "#ff6666",
            background: pid === "P1" ? "rgba(74,158,255,0.08)" : "rgba(255,102,102,0.08)",
            padding: "3px 10px", borderRadius: 6,
            border: `1px solid ${pid === "P1" ? "#4a9eff33" : "#ff666633"}`,
          }}>{name}'s TURN</div>
        </div>

        {/* Active synergies */}
        {player.activeSynergies.length > 0 && (
          <div style={{ display: "flex", gap: 4 }}>
            {player.activeSynergies.slice(0, 3).map(id => (
              <div key={id} style={{
                fontSize: 7, padding: "2px 5px", borderRadius: 4,
                background: "rgba(255,200,50,0.08)", border: "1px solid #ffcc0044",
                color: "#ffcc00", letterSpacing: 1,
              }}>{id.replace(/_/g, " ").toUpperCase()}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {targeting && (
            <motion.button
              onClick={() => dispatch({ type: "CANCEL_ATTACK", pid })}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: "7px 14px",
                background: "rgba(255,80,40,0.08)", border: "1px solid #ff644433",
                borderRadius: 8, color: "#ff6444", fontSize: 9, fontWeight: 800,
                letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
              }}
            >CANCEL</motion.button>
          )}
          <motion.button
            onClick={handleEndTurn}
            whileHover={{ scale: 1.05, boxShadow: "0 0 18px #44ff8855" }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: "7px 18px",
              background: "linear-gradient(135deg, #0a2a10, #0d3a15)",
              border: "1px solid #44ff8833",
              borderRadius: 8, color: "#44ff88", fontSize: 10, fontWeight: 900,
              letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
            }}
          >END TURN →</motion.button>
        </div>
      </div>

      {/* ── ACTIVE PLAYER BOARD ──────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "6px 16px 10px", gap: 16,
        position: "relative", zIndex: 1,
      }}>
        <div style={{ position: "absolute", bottom: 6, left: 14, fontSize: 9, letterSpacing: 3, color: "#2a2a38" }}>
          YOUR BOARD
        </div>
        <LeaderView
          leader={player.leader}
          cardDb={cardDb}
          playerName={name}
          playerIcon={icon}
          selected={battleState.pendingAttackerId === player.leader.instanceId}
          energy={player.energy}
          maxEnergy={player.maxEnergy}
          domainMeter={player.domainMeter}
          showDomainBtn
          onSelect={() => handleSelectAttacker(player.leader.instanceId)}
          onDomainActivate={() => dispatch({ type: "ACTIVATE_DOMAIN", pid })}
        />
        <BoardRow
          board={player.board}
          cardDb={cardDb}
          pendingId={battleState.pendingAttackerId}
          targeting={false}
          myBoard
          onSelectCard={handleSelectAttacker}
        />
      </div>

      {/* ── HAND ─────────────────────────────────────────────────────────── */}
      <HandRow
        hand={player.hand}
        cardDb={cardDb}
        energy={player.energy}
        costReduction={player.costReduction}
        onPlay={handlePlayCard}
      />

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHandoff && (
          <HandoffOverlay
            key="handoff"
            name={showHandoff.name}
            icon={showHandoff.icon}
            onReady={() => setShowHandoff(null)}
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
            winnerName={winnerName}
            winnerIcon={winnerIcon}
            onDone={() => onGameOver(battleState.winner!)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
