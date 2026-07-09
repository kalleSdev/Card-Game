import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerId, CardDef } from "@cg/contracts";
import type { BattleState, BattleCard, BattlePlayer, BattleIntent, SpellCard, PendingDomainAction } from "../battleEngine";
import { createBattleEngine, createBattleState, getSynergyLabel } from "../battleEngine";
import type { PlayerDraftResult } from "./DraftBattleScreen";
import CharacterCard from "../components/CharacterCard";
import PlayerIcon from "../components/PlayerIcon";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout overview:
//
//  ┌─────────────────────────────────────────┐
//  │  [Opponent Leader — centered, top]       │  oppLeader row
//  │  ──────────── opponent board ───────────  │  oppBoard row  (flex 1)
//  │  ═══════════ CENTER INFO BAR ═══════════  │  infoBar
//  │  ──────────── player board ─────────────  │  myBoard row   (flex 1)
//  │  [My Leader — centered, bottom]          │  myLeader row
//  │  [Hand]                                  │  hand row
//  └─────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  p1Draft: PlayerDraftResult;
  p2Draft: PlayerDraftResult;
  cardDb: Record<string, CardDef>;
  p1Name: string; p2Name: string;
  p1Icon: string; p2Icon: string;
  onGameOver: (winner: PlayerId, turnCount: number) => void;
}

// ── BoardCardView ─────────────────────────────────────────────────────────────
function BoardCardView({
  card, cardDb, selected, targetable, friendlyTarget, onClick,
}: {
  card: BattleCard; cardDb: Record<string, CardDef>;
  selected?: boolean; targetable?: boolean; friendlyTarget?: boolean; onClick?: () => void;
}) {
  const def = cardDb[card.defId];
  const hpPct   = Math.max(0, Math.min(100, (card.currentHp / card.maxHp) * 100));
  const hpColor = hpPct > 60 ? "#44ff88" : hpPct > 30 ? "#ffcc00" : "#ff4444";

  return (
    <motion.div
      onClick={onClick}
      animate={{
        scale: selected ? 1.08 : 1,
        filter: friendlyTarget
          ? "brightness(1.2) drop-shadow(0 0 8px #4aeecc)"
          : targetable
          ? "brightness(1.2) drop-shadow(0 0 8px #ff4444)"
          : card.exhausted
          ? "brightness(0.5) saturate(0.35)"
          : "brightness(1)",
      }}
      whileHover={onClick ? { y: -8, scale: selected ? 1.1 : 1.07 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      style={{ position: "relative", cursor: onClick ? "pointer" : "default", userSelect: "none" }}
    >
      <CharacterCard defId={card.defId} def={def} size="xs" noHover hideInfo />

      {/* Bottom overlay: name + ATK/HP */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.92) 30%)",
        borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
        padding: "10px 4px 4px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      }}>
        <div style={{ fontSize: 7, fontWeight: 800, color: "#e8e8e8", letterSpacing: 0.5, textAlign: "center", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", paddingLeft: 2, paddingRight: 2 }}>
          {def?.name ?? card.defId}
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", width: "100%", padding: "1px 4px" }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: "#ff8855" }}>⚔{card.atk}</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: hpColor }}>♥{card.currentHp}</span>
        </div>
        {/* HP bar */}
        <div style={{ width: "calc(100% - 8px)", height: 3, background: "#111", borderRadius: 2 }}>
          <motion.div
            animate={{ width: `${hpPct}%` }} transition={{ duration: 0.3 }}
            style={{ height: "100%", background: hpColor, borderRadius: 2 }}
          />
        </div>
      </div>

      {/* Stun */}
      {card.stunTurns > 0 && (
        <div style={{
          position: "absolute", top: 3, right: 3,
          background: "#4488ff", borderRadius: 3,
          fontSize: 7, fontWeight: 900, padding: "1px 4px", color: "#fff",
        }}>STUN</div>
      )}

      {/* Selection ring */}
      {selected && (
        <motion.div
          animate={{ boxShadow: ["0 0 0 3px #ffcc00, 0 0 14px #ffcc0077", "0 0 0 3px #ffcc00, 0 0 26px #ffcc00bb"] }}
          transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
          style={{ position: "absolute", inset: -2, borderRadius: 12, pointerEvents: "none" }}
        />
      )}

      {/* Enemy target ring */}
      {targetable && !selected && !friendlyTarget && (
        <motion.div
          animate={{ boxShadow: ["0 0 0 3px #ff4444, 0 0 12px #ff444477", "0 0 0 3px #ff6666, 0 0 20px #ff4444aa"] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          style={{ position: "absolute", inset: -2, borderRadius: 12, pointerEvents: "none" }}
        />
      )}

      {/* Friendly buff target ring */}
      {friendlyTarget && !selected && (
        <motion.div
          animate={{ boxShadow: ["0 0 0 3px #4aeecc, 0 0 12px #4aeecc77", "0 0 0 3px #4aeecc, 0 0 20px #4aeeccaa"] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          style={{ position: "absolute", inset: -2, borderRadius: 12, pointerEvents: "none" }}
        />
      )}

      {/* Idle glow for ready cards */}
      {!card.exhausted && !selected && !targetable && !friendlyTarget && (
        <motion.div
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", inset: -1, borderRadius: 12, pointerEvents: "none", zIndex: -1,
            boxShadow: "0 0 8px rgba(80,80,255,0.15)",
          }}
        />
      )}

      {/* Sheep overlay */}
      {card.isSheep && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 10, zIndex: 5,
          background: "rgba(200,200,200,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>🐑</div>
      )}
    </motion.div>
  );
}

// ── HandCardView ──────────────────────────────────────────────────────────────
function HandCardView({
  card, cardDb, energy, costReduction, onPlay,
}: {
  card: BattleCard; cardDb: Record<string, CardDef>;
  energy: number; costReduction: number; onPlay: () => void;
}) {
  const def = cardDb[card.defId];
  const cost = Math.max(0, card.cost - costReduction);
  const canAfford = energy >= cost;
  const hpPct   = Math.max(0, Math.min(100, (card.currentHp / card.maxHp) * 100));
  const hpColor = hpPct > 60 ? "#44ff88" : hpPct > 30 ? "#ffcc00" : "#ff4444";

  return (
    <motion.div
      onClick={canAfford ? onPlay : undefined}
      whileHover={canAfford ? { y: -14, scale: 1.1 } : { y: -2, opacity: 0.7 }}
      whileTap={canAfford ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      style={{ position: "relative", cursor: canAfford ? "pointer" : "not-allowed", userSelect: "none", flexShrink: 0 }}
    >
      <CharacterCard defId={card.defId} def={def} size="s" noHover dimmed={!canAfford} hideInfo />

      {/* Cost badge */}
      <div style={{
        position: "absolute", top: -10, right: -10,
        width: 26, height: 26, borderRadius: "50%",
        background: canAfford ? "#4aeecc" : "#222",
        border: `2px solid ${canAfford ? "#2af" : "#333"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 900, color: canAfford ? "#001a16" : "#555",
        boxShadow: canAfford ? "0 0 12px #4aeecc99" : "none",
      }}>{cost}</div>

      {/* Bottom overlay: name + ATK/HP */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.92) 30%)",
        borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
        padding: "12px 4px 4px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#e8e8e8", letterSpacing: 0.3, textAlign: "center", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", paddingLeft: 3, paddingRight: 3 }}>
          {def?.name ?? card.defId}
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", width: "100%", padding: "1px 4px" }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: "#ff8855" }}>⚔{card.atk}</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: hpColor }}>♥{card.currentHp}</span>
        </div>
        <div style={{ width: "calc(100% - 8px)", height: 3, background: "#111", borderRadius: 2 }}>
          <motion.div animate={{ width: `${hpPct}%` }} transition={{ duration: 0.3 }}
            style={{ height: "100%", background: hpColor, borderRadius: 2 }} />
        </div>
      </div>

    </motion.div>
  );
}

// ── SpellCardView — synergy-granted spell shown in spell panel ───────────────
function SpellCardView({
  spell, active, onClick,
}: {
  spell: SpellCard; active?: boolean; onClick?: () => void;
}) {
  const effKind = spell.effect.kind;
  const needsTarget = effKind === "DAMAGE_TARGET" || effKind === "STUN_ONE" || effKind === "PURPLE";
  const needsOwnTarget = effKind === "BUFF_ONE_HP" || effKind === "BUFF_ONE_ATK";
  const color = effKind === "DAMAGE_TARGET" ? "#ff6644"
    : effKind === "BUFF_BOARD_ATK" ? "#ffcc00"
    : effKind === "BUFF_BOARD_HP"  ? "#44ff88"
    : effKind === "BUFF_ONE_ATK"   ? "#ffaa44"
    : effKind === "BUFF_ONE_HP"    ? "#44ffaa"
    : effKind === "DRAW"           ? "#4488ff"
    : effKind === "GAIN_ENERGY"    ? "#4aeecc"
    : effKind === "PURPLE"         ? "#bb44ff"
    : "#cc44ff";
  const icon = effKind === "DAMAGE_TARGET" ? "💥" : effKind === "BUFF_BOARD_ATK" ? "⚔" : effKind === "BUFF_BOARD_HP" ? "💚" : effKind === "BUFF_ONE_ATK" ? "🗡" : effKind === "BUFF_ONE_HP" ? "💉" : effKind === "DRAW" ? "🃏" : effKind === "GAIN_ENERGY" ? "⚡" : effKind === "PURPLE" ? "🌌" : "❄";

  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { y: -12, scale: 1.06 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      animate={active ? { boxShadow: [`0 0 0 2px ${color}, 0 0 18px ${color}88`, `0 0 0 2px ${color}, 0 0 32px ${color}cc`] } : {}}
      transition={{ duration: 0.6, repeat: active ? Infinity : 0, repeatType: "reverse" }}
      style={{
        width: 90, borderRadius: 10, padding: "10px 8px",
        background: `linear-gradient(180deg, ${color}18, rgba(4,4,12,0.95))`,
        border: `1px solid ${color}55`,
        cursor: onClick ? "pointer" : "default",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        userSelect: "none", flexShrink: 0,
        boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 10px ${color}22`,
        position: "relative",
      }}
    >
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 9, fontWeight: 900, color, letterSpacing: 0.5, textAlign: "center", lineHeight: 1.3 }}>
        {spell.name}
      </div>
      <div style={{ fontSize: 7, color: `${color}bb`, textAlign: "center", lineHeight: 1.4 }}>
        {spell.description}
      </div>
      {needsTarget && onClick && (
        <div style={{ fontSize: 7, color: "#ffcc00", letterSpacing: 1, fontWeight: 900, marginTop: 1 }}>▶ TARGET</div>
      )}
      {needsOwnTarget && onClick && (
        <div style={{ fontSize: 7, color: "#88ffcc", letterSpacing: 1, fontWeight: 900, marginTop: 1 }}>▶ PICK CARD</div>
      )}
    </motion.div>
  );
}

// ── CenteredLeader — the leader shown at top or bottom of board ───────────────
function CenteredLeader({
  leader, cardDb, playerName, playerIcon,
  selected, targetable,
  energy, maxEnergy, domainMeter, showDomainBtn,
  onSelect, onDomainActivate,
  isTop,
}: {
  leader: BattleCard; cardDb: Record<string, CardDef>;
  playerName: string; playerIcon: string;
  selected?: boolean; targetable?: boolean;
  energy?: number; maxEnergy?: number;
  domainMeter?: number; showDomainBtn?: boolean;
  onSelect?: () => void; onDomainActivate?: () => void;
  isTop: boolean;
}) {
  const def = cardDb[leader.defId];
  const hpPct   = Math.max(0, Math.min(100, (leader.currentHp / leader.maxHp) * 100));
  const hpColor = hpPct > 50 ? "#44ff88" : hpPct > 25 ? "#ffcc00" : "#ff4444";
  const meterFull = (domainMeter ?? 0) >= 100;
  const isActivePlayer = energy !== undefined;

  return (
    <div style={{
      display: "flex",
      flexDirection: isTop ? "column" : "column-reverse",
      alignItems: "center",
      gap: 6,
      padding: isTop ? "8px 0 4px" : "4px 0 8px",
    }}>
      {/* Name + icon row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
          <PlayerIcon icon={playerIcon} size={22} style={{ display: "block" }} />
        </div>
        <span style={{ fontSize: 10, color: "#778", letterSpacing: 1, fontWeight: 600 }}>{playerName}</span>
        {/* HP indicator next to name */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "2px 8px",
          border: `1px solid ${hpColor}44`,
        }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: "#ff8855" }}>⚔{leader.atk}</span>
          <span style={{ fontSize: 10, color: "#334" }}>·</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: hpColor }}>♥{leader.currentHp}/{leader.maxHp}</span>
        </div>
        {leader.stunTurns > 0 && (
          <div style={{ background: "#4488ff", borderRadius: 4, fontSize: 8, fontWeight: 900, padding: "1px 6px", color: "#fff" }}>
            STUN
          </div>
        )}
      </div>

      {/* Leader card + rings */}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* Energy/Domain panel — only for active player, shown to the left of their leader */}
        {isActivePlayer && !isTop && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 110 }}>
            {/* Energy header */}
            <div style={{ fontSize: 9, color: "#4aeecc", fontWeight: 800, letterSpacing: 1 }}>
              ⚡ ENERGY {energy}/{maxEnergy}
            </div>

            {/* Crystal grid */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
              {Array.from({ length: maxEnergy ?? 0 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={i < (energy ?? 0)
                    ? { boxShadow: ["0 0 4px #4aeecc66", "0 0 10px #4aeecc", "0 0 4px #4aeecc66"] }
                    : {}}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.07 }}
                  style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: i < (energy ?? 0)
                      ? "linear-gradient(135deg, #2af 0%, #4aeecc 100%)"
                      : "#0d0d18",
                    border: `1px solid ${i < (energy ?? 0) ? "#4aeecc" : "#1e1e2e"}`,
                    transition: "background 0.2s, border-color 0.2s",
                  }}
                />
              ))}
            </div>

            {/* Domain meter */}
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 7, color: meterFull ? "#cc44ff" : "#2a2a3a", letterSpacing: 1 }}>DOMAIN</span>
                <span style={{ fontSize: 7, color: meterFull ? "#cc44ff" : "#2a2a3a" }}>{domainMeter ?? 0}%</span>
              </div>
              <div style={{ height: 7, background: "#090912", borderRadius: 4, overflow: "hidden", border: "1px solid #1a1a2e" }}>
                <motion.div
                  animate={{ width: `${domainMeter ?? 0}%` }} transition={{ duration: 0.4 }}
                  style={{
                    height: "100%",
                    background: meterFull
                      ? "linear-gradient(90deg, #cc44ff, #ff44cc)"
                      : "linear-gradient(90deg, #3a1070, #5a1eaa)",
                    borderRadius: 4,
                    boxShadow: meterFull ? "0 0 8px #cc44ffaa" : "none",
                  }}
                />
              </div>
              {showDomainBtn && meterFull && (
                <motion.button
                  onClick={onDomainActivate}
                  animate={{ boxShadow: ["0 0 10px #cc44ff77", "0 0 22px #cc44ffbb", "0 0 10px #cc44ff77"] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{
                    width: "100%", marginTop: 5,
                    background: "linear-gradient(135deg, #3a0066, #7700bb)",
                    border: "2px solid #cc44ff", borderRadius: 8,
                    color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: 2,
                    padding: "5px 0", cursor: "pointer", fontFamily: "inherit",
                  }}
                >✦ DOMAIN</motion.button>
              )}
            </div>
          </div>
        )}

        {/* The leader card itself */}
        <motion.div
          onClick={onSelect}
          whileHover={onSelect ? { scale: 1.07, y: isTop ? 4 : -4 } : undefined}
          whileTap={onSelect ? { scale: 0.96 } : undefined}
          style={{ position: "relative", cursor: onSelect ? "pointer" : "default", userSelect: "none" }}
        >
          <CharacterCard defId={leader.defId} def={def} size="sm" noHover />

          {/* LEADER badge */}
          <div style={{
            position: "absolute", top: 4, left: 4,
            fontSize: 7, fontWeight: 900, letterSpacing: 1,
            background: "rgba(255,200,0,0.88)", color: "#000",
            padding: "1px 6px", borderRadius: 3,
          }}>LEADER</div>

          {/* HP bar at bottom of card */}
          <div style={{ position: "absolute", bottom: 2, left: 4, right: 4, height: 4, background: "#111", borderRadius: 2 }}>
            <motion.div
              animate={{ width: `${hpPct}%` }} transition={{ duration: 0.35 }}
              style={{ height: "100%", background: hpColor, borderRadius: 2 }}
            />
          </div>

          {/* Selection ring */}
          {selected && (
            <motion.div
              animate={{ boxShadow: ["0 0 0 3px #ffcc00, 0 0 18px #ffcc0088", "0 0 0 3px #ffcc00, 0 0 30px #ffcc00cc"] }}
              transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
              style={{ position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none" }}
            />
          )}

          {/* Target ring */}
          {targetable && !selected && (
            <motion.div
              animate={{ boxShadow: ["0 0 0 3px #ff4444, 0 0 16px #ff444477", "0 0 0 3px #ff6666, 0 0 26px #ff4444aa"] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              style={{ position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none" }}
            />
          )}
        </motion.div>

        {/* Spacer to balance the energy panel on the other side */}
        {isActivePlayer && !isTop && <div style={{ width: 110 }} />}
      </div>
    </div>
  );
}

// ── LeaderRightPanel — player's leader shown as a right-column panel ──────────
function LeaderRightPanel({
  leader, cardDb, playerName, playerIcon,
  selected, energy, maxEnergy, domainMeter,
  onSelect, onDomainActivate,
}: {
  leader: BattleCard; cardDb: Record<string, CardDef>;
  playerName: string; playerIcon: string;
  selected?: boolean;
  energy: number; maxEnergy: number;
  domainMeter: number;
  onSelect: () => void; onDomainActivate: () => void;
}) {
  const def = cardDb[leader.defId];
  const hpPct   = Math.max(0, Math.min(100, (leader.currentHp / leader.maxHp) * 100));
  const hpColor = hpPct > 50 ? "#44ff88" : hpPct > 25 ? "#ffcc00" : "#ff4444";
  const meterFull = domainMeter >= 100;

  return (
    <div style={{
      width: 190, flexShrink: 0,
      background: "rgba(4,4,16,0.88)", borderLeft: "1px solid #111128",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "10px 10px", gap: 8, justifyContent: "center",
    }}>
      {/* Player name + icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
        <div style={{ borderRadius: 5, overflow: "hidden", border: "1px solid #333", flexShrink: 0 }}>
          <PlayerIcon icon={playerIcon} size={22} style={{ display: "block" }} />
        </div>
        <span style={{ fontSize: 9, color: "#778", letterSpacing: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{playerName}</span>
      </div>

      {/* Leader card */}
      <motion.div
        onClick={onSelect}
        whileHover={{ scale: 1.06, y: -4 }}
        whileTap={{ scale: 0.96 }}
        style={{ position: "relative", cursor: "pointer", userSelect: "none" }}
      >
        <CharacterCard defId={leader.defId} def={def} size="sm" noHover />
        <div style={{
          position: "absolute", top: 4, left: 4,
          fontSize: 7, fontWeight: 900, letterSpacing: 1,
          background: "rgba(255,200,0,0.88)", color: "#000",
          padding: "1px 6px", borderRadius: 3,
        }}>LEADER</div>
        {/* HP bar */}
        <div style={{ position: "absolute", bottom: 2, left: 4, right: 4, height: 4, background: "#111", borderRadius: 2 }}>
          <motion.div animate={{ width: `${hpPct}%` }} transition={{ duration: 0.35 }}
            style={{ height: "100%", background: hpColor, borderRadius: 2 }} />
        </div>
        {selected && (
          <motion.div
            animate={{ boxShadow: ["0 0 0 3px #ffcc00, 0 0 18px #ffcc0088", "0 0 0 3px #ffcc00, 0 0 30px #ffcc00cc"] }}
            transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
            style={{ position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none" }} />
        )}
        {leader.stunTurns > 0 && (
          <div style={{ position: "absolute", top: 4, right: 4, background: "#4488ff", borderRadius: 3, fontSize: 7, fontWeight: 900, padding: "1px 4px", color: "#fff" }}>STUN</div>
        )}
      </motion.div>

      {/* Stats row */}
      <div style={{
        display: "flex", gap: 8, background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "4px 10px",
        border: `1px solid ${hpColor}33`, width: "100%", justifyContent: "center",
      }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#ff8855" }}>⚔{leader.atk}</span>
        <span style={{ fontSize: 11, color: "#334" }}>·</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: hpColor }}>♥{leader.currentHp}/{leader.maxHp}</span>
      </div>

      {/* Domain meter */}
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 7, color: meterFull ? "#cc44ff" : "#2a2a3a", letterSpacing: 1 }}>DOMAIN</span>
          <span style={{ fontSize: 7, color: meterFull ? "#cc44ff" : "#2a2a3a" }}>{domainMeter}%</span>
        </div>
        <div style={{ height: 7, background: "#090912", borderRadius: 4, overflow: "hidden", border: "1px solid #1a1a2e" }}>
          <motion.div animate={{ width: `${domainMeter}%` }} transition={{ duration: 0.4 }}
            style={{
              height: "100%",
              background: meterFull ? "linear-gradient(90deg, #cc44ff, #ff44cc)" : "linear-gradient(90deg, #3a1070, #5a1eaa)",
              borderRadius: 4,
              boxShadow: meterFull ? "0 0 8px #cc44ffaa" : "none",
            }} />
        </div>
        {meterFull && (
          <motion.button
            onClick={onDomainActivate}
            animate={{ boxShadow: ["0 0 10px #cc44ff77", "0 0 22px #cc44ffbb", "0 0 10px #cc44ff77"] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{
              width: "100%", marginTop: 5,
              background: "linear-gradient(135deg, #3a0066, #7700bb)",
              border: "2px solid #cc44ff", borderRadius: 8,
              color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: 2,
              padding: "5px 0", cursor: "pointer", fontFamily: "inherit",
            }}
          >✦ DOMAIN</motion.button>
        )}
      </div>
    </div>
  );
}

// ── Board row (5 slots) ───────────────────────────────────────────────────────
function BoardRow({
  board, cardDb, pendingId, targeting, myBoard, cardScale = 1,
  onSelectCard, onTargetCard,
}: {
  board: (BattleCard | null)[];
  cardDb: Record<string, CardDef>;
  pendingId: string | null; targeting: boolean; myBoard: boolean;
  buffTargeting?: boolean;
  cardScale?: number;
  onSelectCard?: (id: string) => void; onTargetCard?: (id: string) => void;
}) {
  const slotW = Math.round(72 * cardScale);
  const slotH = Math.round(103 * cardScale);
  return (
    <div style={{
      display: "flex", gap: Math.round(10 * cardScale), justifyContent: "center", alignItems: "center",
      flex: 1, minHeight: slotH + 10, padding: "0 8px",
    }}>
      {board.map((card, i) => (
        <div key={i} style={{ width: slotW, height: slotH, flexShrink: 0 }}>
          {card ? (
            <div style={{ transform: `scale(${cardScale})`, transformOrigin: "top left", width: 72, height: 103 }}>
              <BoardCardView
                card={card} cardDb={cardDb}
                selected={pendingId === card.instanceId}
                targetable={targeting && !myBoard}
                friendlyTarget={buffTargeting === true && myBoard}
                onClick={() => {
                  if (myBoard && onSelectCard) onSelectCard(card.instanceId);
                  else if (!myBoard && onTargetCard) onTargetCard(card.instanceId);
                }}
              />
            </div>
          ) : (
            <div style={{
              width: slotW, height: slotH,
              border: `1px dashed ${myBoard ? "#1a2a1a" : "#1a1a2a"}`,
              borderRadius: Math.round(10 * cardScale), background: "rgba(255,255,255,0.005)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── BoardParticles ────────────────────────────────────────────────────────────
function BoardParticles() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            x: [0, (i % 2 === 0 ? 1 : -1) * 20],
            y: ["100%", "-10%"],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 4 + i * 0.7,
            repeat: Infinity,
            delay: i * 0.8,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            left: `${10 + i * 15}%`,
            width: 3, height: 3, borderRadius: "50%",
            background: `hsl(${260 + i * 20},80%,70%)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Handoff overlay ───────────────────────────────────────────────────────────
function HandoffOverlay({ name, icon, onReady }: { name: string; icon: string; onReady: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(2,2,10,0.97)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
      }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
        style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
      >
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#334" }}>TURN END</div>
        <motion.div
          animate={{ boxShadow: ["0 0 24px #ffcc0033", "0 0 48px #ffcc0077", "0 0 24px #ffcc0033"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ borderRadius: "50%", overflow: "hidden", border: "3px solid #ffcc0055" }}
        >
          <PlayerIcon icon={icon} size={80} style={{ display: "block" }} />
        </motion.div>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 4, color: "#fff" }}>PASS TO</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: "#ffcc00", letterSpacing: 2 }}>{name}</div>
        <div style={{ fontSize: 9, color: "#334", letterSpacing: 4 }}>COVER YOUR SCREEN, THEN CONTINUE</div>
      </motion.div>
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={onReady}
        style={{
          padding: "14px 52px",
          background: "linear-gradient(135deg, #1a1a3a, #2a1a4a)",
          border: "2px solid #4a4a7a", borderRadius: 12,
          color: "#aaa", fontSize: 13, fontWeight: 900, letterSpacing: 4,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >I'M READY →</motion.button>
    </motion.div>
  );
}

// ── Domain flash ──────────────────────────────────────────────────────────────
function DomainFlash({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.2, times: [0, 0.08, 0.85, 1] }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "radial-gradient(ellipse at center, #6600cc55 0%, transparent 70%)",
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
        <div style={{ fontSize: 10, letterSpacing: 8, color: "#cc44ff", marginBottom: 10 }}>DOMAIN EXPANSION</div>
        <div style={{
          fontSize: 42, fontWeight: 900, letterSpacing: 3, color: "#fff",
          textShadow: "0 0 40px #cc44ffcc, 0 0 80px #8800aa88",
        }}>{name}</div>
      </motion.div>
    </motion.div>
  );
}

// ── Game over overlay ─────────────────────────────────────────────────────────
function GameOverOverlay({ winnerName, winnerIcon, onDone }: {
  winnerName: string; winnerIcon: string; onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(2,2,10,0.95)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28,
      }}
    >
      <motion.div
        initial={{ scale: 0.6, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
        style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}
      >
        <div style={{ fontSize: 11, letterSpacing: 8, color: "#444" }}>BATTLE OVER</div>
        <motion.div
          animate={{ boxShadow: ["0 0 24px #ffcc0044", "0 0 56px #ffcc0099", "0 0 24px #ffcc0044"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ borderRadius: "50%", overflow: "hidden", border: "3px solid #ffcc0088" }}
        >
          <PlayerIcon icon={winnerIcon} size={88} style={{ display: "block" }} />
        </motion.div>
        <div style={{
          fontSize: 52, fontWeight: 900, color: "#ffcc00", letterSpacing: 3,
          textShadow: "0 0 40px #ffcc0077",
        }}>{winnerName}</div>
        <div style={{ fontSize: 14, letterSpacing: 8, color: "#888" }}>WINS</div>
      </motion.div>
      <motion.button
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={onDone}
        style={{
          padding: "14px 52px",
          background: "linear-gradient(135deg, #2a1a00, #4a3000)",
          border: "2px solid #ffcc0077", borderRadius: 12,
          color: "#ffcc00", fontSize: 13, fontWeight: 900, letterSpacing: 4,
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
  // Mulligan phase: players swap cards before battle starts
  type MulliganStep = "P1" | "P2" | "BATTLE";
  type MulliganSubPhase = "SELECT" | "REPLACED";
  const [mulliganStep, setMulliganStep] = useState<MulliganStep>("P1");
  const [mulliganSubPhase, setMulliganSubPhase] = useState<MulliganSubPhase>("SELECT");
  const [mulliganReturning, setMulliganReturning] = useState<Set<string>>(new Set());
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());

  const [initialState] = useState(() => createBattleState(p1Draft, p2Draft, cardDb));
  const [engine] = useState(() => createBattleEngine(initialState));
  const [battleState, setBattleState] = useState<BattleState>(() => engine.getState());
  const [domainFlash, setDomainFlash] = useState<string | null>(null);
  const [gameOverShown, setGameOverShown] = useState(false);
  const [pendingSpellId, setPendingSpellId] = useState<string | null>(null); // spell awaiting enemy target
  const [buffOneTargeting, setBuffOneTargeting] = useState<string | null>(null); // spell id for BUFF_ONE (own-card target)
  const [turnBackTargeting, setTurnBackTargeting] = useState(false);
  const [drewCardId, setDrewCardId] = useState<string | null>(null); // card drawn this turn (for animation)

  const doReplace = (pid: PlayerId) => {
    if (mulliganReturning.size === 0) return;
    const drawn: string[] = [];
    setBattleState(prev => {
      const p = { ...prev.players[pid] };
      const going  = p.hand.filter(c =>  mulliganReturning.has(c.instanceId));
      const kept   = p.hand.filter(c => !mulliganReturning.has(c.instanceId));
      // Draw from existing deck FIRST so returned cards cannot come back immediately
      const newCards = p.deck.slice(0, going.length);
      newCards.forEach(c => drawn.push(c.instanceId));
      // Returned cards go to the back of the remaining deck
      const rest = [...p.deck.slice(going.length), ...shuffle(going)];
      return { ...prev, players: { ...prev.players, [pid]: { ...p, hand: [...kept, ...newCards], deck: rest } } };
    });
    setNewCardIds(new Set(drawn));
    setMulliganReturning(new Set());
    setMulliganSubPhase("REPLACED");
  };

  const keepHand = (pid: PlayerId) => {
    setMulliganSubPhase("SELECT");
    setMulliganReturning(new Set());
    setNewCardIds(new Set());
    setMulliganStep(pid === "P1" ? "P2" : "BATTLE");
  };

  const dispatch = useCallback((intent: BattleIntent) => {
    const result = engine.apply(intent);
    setBattleState(result.state);
    for (const ev of result.events) {
      if (ev.type === "DOMAIN_ACTIVATED") setDomainFlash(ev.name);
      if (ev.type === "TURN_START" && ev.drew) { setDrewCardId(ev.drew); setTimeout(() => setDrewCardId(null), 700); }
      if (ev.type === "GAME_OVER") { setGameOverShown(true); return; }
    }
  }, [engine]);

  useEffect(() => {
    if (battleState.phase === "DRAW") {
      dispatch({ type: "END_TURN", pid: battleState.activePlayer });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndTurn = () => {
    const pid = battleState.activePlayer;
    dispatch({ type: "END_TURN", pid });
  };

  const handlePlayCard = (instanceId: string) => {
    const pid = battleState.activePlayer;
    const slot = battleState.players[pid].board.findIndex(s => s === null);
    if (slot === -1) return;
    dispatch({ type: "PLAY_CARD", pid, instanceId, slot });
  };

  const handleSelectAttacker = (instanceId: string) => {
    const pid = battleState.activePlayer;
    if (battleState.pendingAttackerId === instanceId) dispatch({ type: "CANCEL_ATTACK", pid });
    else dispatch({ type: "SELECT_ATTACKER", pid, instanceId });
  };

  const handleTargetCard   = (instanceId: string) => {
    const pid = battleState.activePlayer;
    if (!battleState.pendingAttackerId) return;
    dispatch({ type: "ATTACK_CARD", pid, targetInstanceId: instanceId });
  };

  const handleDomainTarget = (targetInstanceId: string) => {
    const pid = battleState.activePlayer;
    dispatch({ type: "DOMAIN_TARGET", pid, targetInstanceId });
  };

  const handleTargetLeader = () => {
    const pid = battleState.activePlayer;
    if (pendingSpellId) {
      dispatch({ type: "CAST_SPELL", pid, spellId: pendingSpellId, targetInstanceId: battleState.players[pid === "P1" ? "P2" : "P1"].leader.instanceId });
      setPendingSpellId(null);
      return;
    }
    if (battleState.pendingDomainAction?.kind === "SNEAK_ATTACK_DOMAIN") {
      handleDomainTarget(battleState.players[pid === "P1" ? "P2" : "P1"].leader.instanceId);
      return;
    }
    if (!battleState.pendingAttackerId) return;
    dispatch({ type: "ATTACK_LEADER", pid });
  };

  const handleSpellClick = (spell: SpellCard) => {
    const pid = battleState.activePlayer;
    const eff = spell.effect;
    if (eff.kind === "TURN_BACK_SHEEP") {
      setTurnBackTargeting(prev => !prev);
      return;
    }
    if (eff.kind === "BUFF_ONE_HP" || eff.kind === "BUFF_ONE_ATK") {
      // Needs own-board target
      dispatch({ type: "CANCEL_ATTACK", pid });
      setBuffOneTargeting(prev => prev === spell.id ? null : spell.id);
      return;
    }
    if (eff.kind === "DAMAGE_TARGET" || eff.kind === "STUN_ONE" || eff.kind === "PURPLE") {
      // Needs enemy target — enter spell targeting mode (deselect any attacker)
      dispatch({ type: "CANCEL_ATTACK", pid });
      setPendingSpellId(prev => prev === spell.id ? null : spell.id);
    } else {
      // No target needed — cast immediately
      dispatch({ type: "CAST_SPELL", pid, spellId: spell.id });
    }
  };

  const handleSpellTargetCard = (instanceId: string) => {
    const pid = battleState.activePlayer;
    if (!pendingSpellId) return;
    dispatch({ type: "CAST_SPELL", pid, spellId: pendingSpellId, targetInstanceId: instanceId });
    setPendingSpellId(null);
  };

  // ── Starting hand phase ─────────────────────────────────────────────────────
  if (mulliganStep !== "BATTLE") {
    const mPid    = mulliganStep as "P1" | "P2";
    const mPlayer = battleState.players[mPid];
    const mName   = mPid === "P1" ? p1Name : p2Name;
    const mIcon   = mPid === "P1" ? p1Icon : p2Icon;
    const mColor  = mPid === "P1" ? "#4a9eff" : "#ff6666";
    const isReplaced = mulliganSubPhase === "REPLACED";
    // Who goes first? — activePlayer is the coin-flip winner (always first in DRAW phase at start)
    const goesFirst = battleState.activePlayer === mPid;

    return (
      <div style={{
        minHeight: "100vh", background: "#04040a",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 28, padding: 32, fontFamily: "'Segoe UI', system-ui, sans-serif",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, #0a0a1a, #04040a)", zIndex: 0 }} />
        {/* First / Second indicator (left edge) */}
        <motion.div
          initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          style={{
            position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)",
            zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}
        >
          <div style={{
            padding: "8px 16px", borderRadius: 10,
            background: goesFirst ? "rgba(74,238,204,0.1)" : "rgba(204,68,255,0.1)",
            border: `1px solid ${goesFirst ? "#4aeecc66" : "#cc44ff66"}`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: goesFirst ? "#4aeecc" : "#cc44ff", letterSpacing: 2 }}>
              {goesFirst ? "FIRST" : "SECOND"}
            </div>
            {!goesFirst && (
              <div style={{ fontSize: 8, color: "#cc44ffaa", letterSpacing: 1, marginTop: 3 }}>
                + extra spell
              </div>
            )}
          </div>
        </motion.div>

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          {/* Player header */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: `2px solid ${mColor}66` }}>
                <img src={`/players/${mIcon}.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontSize: 14, color: mColor, letterSpacing: 3, fontWeight: 700 }}>{mName}</span>
            </div>

            {isReplaced ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4, color: "#fff", marginBottom: 6 }}>
                  YOUR NEW HAND
                </div>
                <div style={{ fontSize: 10, color: "#fff", letterSpacing: 2 }}>
                  Cards highlighted in green were drawn as replacements
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4, color: "#fff", marginBottom: 6 }}>
                  YOUR STARTING HAND
                </div>
                <div style={{ fontSize: 10, color: "#fff", letterSpacing: 2 }}>
                  Select cards to send back and draw fresh replacements from your deck
                </div>
              </>
            )}
          </div>

          {/* Cards */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
            {mPlayer.hand.map(card => {
              const def = cardDb[card.defId];
              const returning  = !isReplaced && mulliganReturning.has(card.instanceId);
              const isNew      = isReplaced && newCardIds.has(card.instanceId);
              return (
                <motion.div key={card.instanceId}
                  initial={isNew ? { scale: 0.7, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={isNew ? { type: "spring", stiffness: 300, damping: 20 } : {}}
                  onClick={() => {
                    if (isReplaced) return;
                    setMulliganReturning(prev => {
                      const next = new Set(prev);
                      if (next.has(card.instanceId)) next.delete(card.instanceId);
                      else next.add(card.instanceId);
                      return next;
                    });
                  }}
                  whileHover={!isReplaced ? { y: -10, scale: 1.06 } : undefined}
                  whileTap={!isReplaced ? { scale: 0.97 } : undefined}
                  style={{ cursor: isReplaced ? "default" : "pointer", position: "relative" }}
                >
                  {def && <CharacterCard defId={card.defId} def={def} size="sm" />}

                  {/* Selected-to-return overlay */}
                  {returning && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: 12,
                      border: "2px solid #ff4444",
                      background: "rgba(255,40,40,0.22)",
                      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                      padding: 6, pointerEvents: "none",
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: "#ff4444", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, color: "#fff", fontWeight: 900,
                      }}>↩</div>
                    </div>
                  )}

                </motion.div>
              );
            })}
          </div>

          {/* Status text */}
          <div style={{ fontSize: 10, color: "#667", letterSpacing: 2, textAlign: "center" }}>
            {isReplaced
              ? `${newCardIds.size} card${newCardIds.size !== 1 ? "s" : ""} replaced`
              : mulliganReturning.size > 0
                ? `${mulliganReturning.size} card${mulliganReturning.size > 1 ? "s" : ""} selected to return`
                : "Click cards to select them for replacement"}
          </div>

          {/* Leader preview — mirrors how it looks in-game */}
          <div style={{
            width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
            gap: 8, padding: "16px 0 0",
            borderTop: "1px solid #101024",
          }}>
            <div style={{ fontSize: 8, color: "#334", letterSpacing: 3 }}>YOUR LEADER</div>
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              {/* Energy crystals */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 110 }}>
                <div style={{ fontSize: 9, color: "#4aeecc", fontWeight: 800, letterSpacing: 1 }}>
                  ⚡ ENERGY 2/2
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ boxShadow: ["0 0 4px #4aeecc66", "0 0 10px #4aeecc", "0 0 4px #4aeecc66"] }}
                      transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.07 }}
                      style={{
                        width: 14, height: 14, borderRadius: 3,
                        background: "linear-gradient(135deg, #2af 0%, #4aeecc 100%)",
                        border: "1px solid #4aeecc",
                      }}
                    />
                  ))}
                </div>
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 7, color: "#2a2a3a", letterSpacing: 1 }}>DOMAIN</span>
                    <span style={{ fontSize: 7, color: "#2a2a3a" }}>0%</span>
                  </div>
                  <div style={{ height: 7, background: "#090912", borderRadius: 4, border: "1px solid #1a1a2e" }} />
                </div>
              </div>
              {/* Leader card */}
              <div style={{ position: "relative" }}>
                {cardDb[mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId] && (
                  <CharacterCard
                    defId={mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId}
                    def={cardDb[mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId]}
                    size="sm" noHover
                  />
                )}
                <div style={{
                  position: "absolute", top: 4, left: 4,
                  fontSize: 7, fontWeight: 900, letterSpacing: 1,
                  background: "rgba(255,200,0,0.88)", color: "#000",
                  padding: "1px 6px", borderRadius: 3,
                }}>LEADER</div>
                <div style={{
                  position: "absolute", bottom: 22, left: 0, right: 0,
                  display: "flex", justifyContent: "space-around", padding: "2px 4px",
                  background: "rgba(0,0,0,0.75)",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#ff8855" }}>⚔2</span>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#44ff88" }}>♥20/20</span>
                </div>
              </div>
              <div style={{ width: 110 }} />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            {!isReplaced && (
              <motion.button
                whileHover={mulliganReturning.size > 0 ? { scale: 1.05, y: -2 } : {}}
                whileTap={mulliganReturning.size > 0 ? { scale: 0.97 } : {}}
                onClick={() => doReplace(mPid)}
                style={{
                  padding: "12px 36px",
                  background: mulliganReturning.size > 0
                    ? "linear-gradient(135deg, #994400, #ff6600)"
                    : "rgba(255,255,255,0.04)",
                  border: `2px solid ${mulliganReturning.size > 0 ? "#ff6600" : "#2a2a3a"}`,
                  borderRadius: 12,
                  color: mulliganReturning.size > 0 ? "#fff" : "#334",
                  fontSize: 12, fontWeight: 900, letterSpacing: 5,
                  cursor: mulliganReturning.size > 0 ? "pointer" : "default",
                  fontFamily: "inherit",
                  boxShadow: mulliganReturning.size > 0 ? "0 0 24px #ff660044" : "none",
                }}
              >REPLACE</motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={() => keepHand(mPid)}
              style={{
                padding: "12px 36px",
                background: `linear-gradient(135deg, ${mColor}aa, ${mColor})`,
                border: "none", borderRadius: 12,
                color: "#000", fontSize: 12, fontWeight: 900, letterSpacing: 5,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: `0 0 28px ${mColor}44`,
              }}
            >{isReplaced ? "NEXT →" : "KEEP HAND"}</motion.button>
          </div>
        </div>
      </div>
    );
  }

  if (!battleState || battleState.phase === "DRAW") {
    return (
      <div style={{ background: "#04040a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#445", letterSpacing: 4, fontSize: 12 }}>PREPARING BOARD…</div>
      </div>
    );
  }

  const pid    = battleState.activePlayer;
  const oppId: PlayerId = pid === "P1" ? "P2" : "P1";
  const player: BattlePlayer = battleState.players[pid];
  const opp:   BattlePlayer  = battleState.players[oppId];
  const name    = pid === "P1" ? p1Name : p2Name;
  const icon    = pid === "P1" ? p1Icon : p2Icon;
  const oppName = oppId === "P1" ? p1Name : p2Name;
  const oppIcon = oppId === "P1" ? p1Icon : p2Icon;
  // enemyTargeting highlights opponent cards; own-card buff targeting does NOT
  const enemyTargeting = battleState.pendingAttackerId !== null || pendingSpellId !== null || battleState.pendingDomainAction !== null;
  const targeting = enemyTargeting || buffOneTargeting !== null;

  const handleOwnCardClick = (instanceId: string) => {
    if (turnBackTargeting) {
      const spell = player.spells.find(s => s.effect.kind === "TURN_BACK_SHEEP");
      if (spell) {
        dispatch({ type: "CAST_SPELL", pid: battleState.activePlayer, spellId: spell.id, targetInstanceId: instanceId });
        setTurnBackTargeting(false);
      }
      return;
    }
    if (buffOneTargeting) {
      dispatch({ type: "CAST_SPELL", pid: battleState.activePlayer, spellId: buffOneTargeting, targetInstanceId: instanceId });
      setBuffOneTargeting(null);
      return;
    }
    handleSelectAttacker(instanceId);
  };

  const winnerName = battleState.winner ? (battleState.winner === "P1" ? p1Name : p2Name) : "";
  const winnerIcon = battleState.winner ? (battleState.winner === "P1" ? p1Icon : p2Icon) : "";

  return (
    <div style={{
      minHeight: "100vh", maxHeight: "100vh",
      background: "linear-gradient(180deg, #020209 0%, #04021a 50%, #020209 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflowX: "hidden", overflowY: "hidden", position: "relative",
    }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "repeating-linear-gradient(0deg,transparent,transparent 47px,#080818 48px)",
        opacity: 0.4,
      }} />

      {/* ── OPPONENT LEADER (top, centered) ──────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid #0c0c1e", background: "rgba(0,0,0,0.2)",
        position: "relative", zIndex: 1, flexShrink: 0,
      }}>
        <CenteredLeader
          leader={opp.leader} cardDb={cardDb}
          playerName={oppName} playerIcon={oppIcon}
          targetable={targeting}
          onSelect={targeting ? handleTargetLeader : undefined}
          isTop
        />
      </div>

      {/* ── OPPONENT BOARD ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "2px solid #0d0d22", position: "relative", zIndex: 20,
        background: "rgba(0,0,0,0.1)",
        minHeight: 130,
      }}>
        <motion.div
          animate={{ opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, #6600aa22, transparent 70%)" }}
        />
        <BoardParticles />
        <div style={{ position: "absolute", top: 4, left: 14, fontSize: 8, letterSpacing: 4, color: "#1a1a2a", zIndex: 1, display: "flex", gap: 8, alignItems: "center" }}>
          OPPONENT
          {opp.cardPlayFrozen > 0 && (
            <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 0.8, repeat: Infinity }}
              style={{ fontSize: 7, letterSpacing: 2, color: "#4488ff", background: "rgba(68,136,255,0.12)", border: "1px solid #4488ff44", borderRadius: 4, padding: "1px 5px" }}>
              ❄ FROZEN {opp.cardPlayFrozen}T
            </motion.div>
          )}
        </div>
        <BoardRow
          board={opp.board} cardDb={cardDb} cardScale={1.3}
          pendingId={null} targeting={enemyTargeting} myBoard={false}
          onTargetCard={pendingSpellId ? handleSpellTargetCard : battleState.pendingDomainAction ? handleDomainTarget : handleTargetCard}
        />
      </div>

      {/* ── CENTER INFO BAR ───────────────────────────────────────────────── */}
      <div style={{
        padding: "6px 24px", zIndex: 2,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid #0d0d1e", borderBottom: "1px solid #0d0d1e",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 8, color: "#1c1c2c", letterSpacing: 3 }}>TURN {battleState.turn}</div>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 2,
            color: pid === "P1" ? "#4a9eff" : "#ff6666",
            background: pid === "P1" ? "rgba(74,158,255,0.07)" : "rgba(255,102,102,0.07)",
            padding: "3px 12px", borderRadius: 6,
            border: `1px solid ${pid === "P1" ? "#4a9eff33" : "#ff666633"}`,
          }}>{name}'s TURN</div>
        </div>

        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {pendingSpellId && (
            <div style={{
              fontSize: 7, padding: "2px 8px", borderRadius: 4,
              background: "rgba(204,68,255,0.12)", border: "1px solid #cc44ff66",
              color: "#cc44ff", letterSpacing: 1, fontWeight: 900,
            }}>✦ SELECT TARGET</div>
          )}
          {battleState.pendingDomainAction && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(204,68,255,0.15)", border: "1px solid #cc44ff88",
              color: "#cc44ff", letterSpacing: 1, fontWeight: 900,
            }}>
              {battleState.pendingDomainAction.kind === "CHOOSE_KILL_ENEMIES"
                ? `✦ SELECT ${battleState.pendingDomainAction.remaining} ENEMY CARD${battleState.pendingDomainAction.remaining > 1 ? "S" : ""} TO ELIMINATE`
                : battleState.pendingDomainAction.kind === "COPY_ENEMY_CARD"
                ? "✦ SELECT AN ENEMY CARD TO COPY"
                : battleState.pendingDomainAction.kind === "HEAL_AND_KILL_ONE"
                ? "✦ SELECT AN ENEMY CARD TO DESTROY"
                : "✦ SELECT ANY ENEMY TARGET"}
            </div>
          )}
          {turnBackTargeting && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(68,255,136,0.12)", border: "1px solid #44ff8866",
              color: "#44ff88", letterSpacing: 1, fontWeight: 900,
            }}>✦ SELECT A CARD TO RESTORE</div>
          )}
          {buffOneTargeting && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(74,158,255,0.12)", border: "1px solid #4a9eff66",
              color: "#4a9eff", letterSpacing: 1, fontWeight: 900,
            }}>✦ SELECT YOUR CARD TO BUFF</div>
          )}
          {player.activeSynergies.map(id => (
            <div key={id} style={{
              fontSize: 7, padding: "2px 6px", borderRadius: 4,
              background: "rgba(100,255,150,0.07)", border: "1px solid #44ff8833",
              color: "#44ff88aa", letterSpacing: 1,
            }}>✦ {getSynergyLabel(id)}</div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* No cancel button — click card again to deselect */}
          <motion.button
            onClick={handleEndTurn}
            whileHover={{ scale: 1.05, boxShadow: "0 0 16px #44ff8844" }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: "7px 20px",
              background: "linear-gradient(135deg, #0a2a12, #0d3a16)",
              border: "1px solid #44ff8822",
              borderRadius: 8, color: "#44ff88", fontSize: 10, fontWeight: 900,
              letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
            }}
          >END TURN →</motion.button>
        </div>
      </div>

      {/* ── MY BOARD + LEADER PANEL (row: board center, leader right) ───── */}
      <div style={{
        flex: 1.5, display: "flex", flexDirection: "row",
        position: "relative", zIndex: 20, minHeight: 200,
        borderBottom: "1px solid #0d0d22",
      }}>
        <motion.div
          animate={{ opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, #6600aa22, transparent 70%)" }}
        />
        <BoardParticles />
        {/* Board area */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ position: "absolute", top: 4, left: 14, fontSize: 8, letterSpacing: 4, color: "#1a1a2a", zIndex: 1 }}>YOUR BOARD</div>
          <BoardRow
            board={player.board} cardDb={cardDb} cardScale={1.5}
            pendingId={battleState.pendingAttackerId}
            targeting={false} buffTargeting={buffOneTargeting !== null} myBoard
            onSelectCard={handleOwnCardClick}
          />
        </div>
        {/* Leader panel (right) */}
        <LeaderRightPanel
          leader={player.leader} cardDb={cardDb}
          playerName={name} playerIcon={icon}
          selected={battleState.pendingAttackerId === player.leader.instanceId}
          energy={player.energy} maxEnergy={player.maxEnergy}
          domainMeter={player.domainMeter}
          onSelect={() => {
            if (buffOneTargeting) {
              dispatch({ type: "CAST_SPELL", pid, spellId: buffOneTargeting, targetInstanceId: player.leader.instanceId });
              setBuffOneTargeting(null);
              return;
            }
            handleSelectAttacker(player.leader.instanceId);
          }}
          onDomainActivate={() => dispatch({ type: "ACTIVATE_DOMAIN", pid })}
        />
      </div>

      {/* ── HAND + SPELLS + DECK (bottom row) ───────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: "flex", flexDirection: "row",
        background: "rgba(0,0,0,0.35)", borderTop: "1px solid #0c0c1e",
        position: "relative", zIndex: 30, minHeight: 130, overflow: "visible",
      }}>
        {/* Spells panel (left column) */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          padding: "10px 12px", borderRight: "1px solid #1a1a30", gap: 8, minWidth: 110,
        }}>
          <div style={{ fontSize: 7, color: "#334", letterSpacing: 3, fontWeight: 700 }}>SPELLS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {player.spells.map(spell => (
              <SpellCardView
                key={spell.id}
                spell={spell}
                active={pendingSpellId === spell.id || buffOneTargeting === spell.id}
                onClick={() => handleSpellClick(spell)}
              />
            ))}
            {player.spells.length === 0 && (
              <div style={{ fontSize: 7, color: "#222", letterSpacing: 1, paddingTop: 4 }}>—</div>
            )}
          </div>
        </div>

        {/* GET SPELL button column (right of spells) */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 10px", borderRight: "1px solid #1a1a30", gap: 6, minWidth: 80,
        }}>
          {(() => {
            const canDraw = player.activeSynergies.length > 0;
            const disabled = !canDraw || player.synergyDrawUsed || player.energy < 2;
            return (
              <motion.button
                whileHover={!disabled ? { scale: 1.07, y: -3, boxShadow: "0 0 22px #cc44ff88" } : {}}
                whileTap={!disabled ? { scale: 0.94 } : {}}
                onClick={() => { if (!disabled) dispatch({ type: "DRAW_SYNERGY_SPELL", pid }); }}
                disabled={disabled}
                style={{
                  width: 64, padding: "10px 6px", borderRadius: 12,
                  cursor: disabled ? "not-allowed" : "pointer",
                  background: disabled
                    ? "rgba(255,255,255,0.02)"
                    : "linear-gradient(160deg, rgba(180,60,255,0.18), rgba(100,20,180,0.14))",
                  border: `2px solid ${disabled ? "#1a1a30" : "#cc44ff88"}`,
                  color: disabled ? "#334" : "#cc44ff",
                  fontSize: 8, fontWeight: 900, letterSpacing: 1, fontFamily: "inherit",
                  opacity: disabled ? 0.3 : 1,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  boxShadow: !disabled ? "0 0 18px #cc44ff33" : "none",
                  transition: "opacity 0.2s",
                }}
              >
                <span style={{ fontSize: 16 }}>✦</span>
                <span style={{ lineHeight: 1.2, textAlign: "center" }}>GET<br/>SPELL</span>
                <span style={{
                  fontSize: 10, fontWeight: 900,
                  color: disabled ? "#334" : "#4aeecc",
                  background: disabled ? "transparent" : "rgba(74,238,204,0.1)",
                  border: disabled ? "none" : "1px solid #4aeecc44",
                  borderRadius: 6, padding: "1px 5px",
                }}>2⚡</span>
                {player.synergyDrawUsed && (
                  <span style={{ fontSize: 6, color: "#556", letterSpacing: 0.5 }}>USED</span>
                )}
                {!canDraw && (
                  <span style={{ fontSize: 6, color: "#334", letterSpacing: 0.5, textAlign: "center" }}>NO SYN</span>
                )}
              </motion.button>
            );
          })()}
        </div>

        {/* Hand cards (center) */}
        <div style={{
          flex: 1, display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-end",
          padding: "14px 20px 10px", overflow: "visible", position: "relative", zIndex: 10,
        }}>
          {player.hand.map(card => {
            const isDrawn = drewCardId === card.instanceId;
            return (
              <motion.div
                key={card.instanceId}
                initial={isDrawn ? { y: 60, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={isDrawn ? { type: "spring", stiffness: 380, damping: 22 } : {}}
                style={{ flexShrink: 0, position: "relative", zIndex: 10 }}
              >
                <HandCardView
                  card={card} cardDb={cardDb}
                  energy={player.energy} costReduction={player.costReduction}
                  onPlay={() => handlePlayCard(card.instanceId)}
                />
              </motion.div>
            );
          })}
          {player.hand.length === 0 && (
            <div style={{ color: "#2a2a38", fontSize: 10, letterSpacing: 3, paddingBottom: 8, paddingTop: 8, alignSelf: "center" }}>
              NO CARDS IN HAND
            </div>
          )}
        </div>

        {/* Energy bar column (between hand and deck) */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 10px", borderLeft: "1px solid #1a1a30", gap: 6, minWidth: 60,
        }}>
          <div style={{ fontSize: 9, color: "#4aeecc", fontWeight: 800, letterSpacing: 1, textAlign: "center" }}>
            ⚡ {player.energy}/{player.maxEnergy}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
            {Array.from({ length: player.maxEnergy }).map((_, i) => (
              <motion.div key={i}
                animate={i < player.energy ? { boxShadow: ["0 0 4px #4aeecc66", "0 0 10px #4aeecc", "0 0 4px #4aeecc66"] } : {}}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.07 }}
                style={{
                  width: 16, height: 10, borderRadius: 3,
                  background: i < player.energy ? "linear-gradient(135deg, #2af 0%, #4aeecc 100%)" : "#0d0d18",
                  border: `1px solid ${i < player.energy ? "#4aeecc" : "#1e1e2e"}`,
                }} />
            ))}
          </div>
          <div style={{ fontSize: 7, color: "#334", letterSpacing: 2 }}>ENERGY</div>
        </div>

        {/* Deck (right column) */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 16px", borderLeft: "1px solid #1a1a30", gap: 5, minWidth: 80,
        }}>
          <div style={{ position: "relative", width: 52, height: 72 }}>
            {[4, 3, 2, 1, 0].map(offset => (
              <div key={offset} style={{
                position: "absolute",
                top: -offset * 2.2, left: offset * 0.8,
                width: 52, height: 72, borderRadius: 7,
                background: offset === 0 ? "rgba(20,20,60,0.96)" : "rgba(10,10,30,0.8)",
                border: `1px solid ${offset === 0 ? "#3a3a7a" : "#1e1e3a"}`,
                display: offset === 0 ? "flex" : "block",
                alignItems: "center", justifyContent: "center",
                fontSize: 22, color: "#446",
                boxShadow: offset === 0 ? "0 4px 18px rgba(0,0,0,0.7)" : "none",
              }}>
                {offset === 0 ? "🃏" : null}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#667", letterSpacing: 1, marginTop: 2 }}>
            {player.deck.length}
          </div>
          <div style={{ fontSize: 8, color: "#334", letterSpacing: 3 }}>DECK</div>
        </div>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {domainFlash && (
          <DomainFlash key="domain" name={domainFlash} onDone={() => setDomainFlash(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gameOverShown && battleState.winner && (
          <GameOverOverlay key="gameover" winnerName={winnerName} winnerIcon={winnerIcon} onDone={() => onGameOver(battleState.winner!, battleState.turn)} />
        )}
      </AnimatePresence>
    </div>
  );
}
