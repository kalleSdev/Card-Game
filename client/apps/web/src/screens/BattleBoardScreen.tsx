import { useCallback, useEffect, useState, useRef, Component } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";

// ── ErrorBoundary — catches render crashes and shows the error ────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#04040a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32 }}>
          <div style={{ color: "#ff4444", fontSize: 16, fontWeight: 900, letterSpacing: 2 }}>RENDER ERROR</div>
          <div style={{ color: "#ff8888", fontSize: 12, fontFamily: "monospace", background: "#110000", padding: 16, borderRadius: 8, maxWidth: 800, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {this.state.error.message}
          </div>
          <div style={{ color: "#ff6666", fontSize: 10, fontFamily: "monospace", background: "#110000", padding: 16, borderRadius: 8, maxWidth: 800, whiteSpace: "pre-wrap", wordBreak: "break-all", overflow: "auto", maxHeight: 300 }}>
            {this.state.error.stack}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import type { PlayerId, CardDef } from "@cg/contracts";
import type { BattleState, BattleCard, BattlePlayer, BattleIntent, BattleEvent, SpellCard } from "@cg/battle";
import { createBattleEngine, createBattleState, DOMAIN_BATTLE_EFFECTS, BATTLE_SYNERGY_RULES, CARD_PERKS } from "@cg/battle";
import BattleArena from "../components/BattleArena";
import RopeTimer from "../components/RopeTimer";
import BattleLog from "../components/BattleLog";
import type { LogEntry } from "../components/BattleLog";
import { DOMAIN_COLOR, DEFAULT_DOMAIN_COLOR, COLOR } from "../theme";
import { describeDomain } from "../domainText";
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

// ── Shared tooltip bubble via portal ─────────────────────────────────────────
function HoverTooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return createPortal(
    <div style={{
      position: "fixed",
      left: Math.min(Math.max(8, x + 16), window.innerWidth - 360),
      top: Math.min(Math.max(10, y - 10), window.innerHeight - 320),
      zIndex: 9999, pointerEvents: "none", width: 340,
      background: "rgba(6,3,18,0.98)",
      border: "1px solid #7744ccaa", borderRadius: 14,
      padding: "16px 20px",
      boxShadow: "0 12px 48px rgba(0,0,0,0.9), 0 0 32px #7744cc33",
    }}>
      {children}
    </div>,
    document.body
  );
}


// ── DomainBadge — hoverable 🌀 DOMAIN tag ────────────────────────────────────
function DomainBadge({ defId }: { defId: string }) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const d = DOMAIN_BATTLE_EFFECTS[defId];
  if (!d) return null;
  const { desc, secondDesc } = describeDomain(defId) ?? { desc: "", secondDesc: undefined };
  return (
    <>
      <div
        onMouseMove={ev => setTooltipPos({ x: ev.clientX, y: ev.clientY })}
        onMouseLeave={() => setTooltipPos(null)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
          color: "#dd55ff", background: "rgba(80,0,130,0.8)",
          border: "1px solid #cc44ff88", borderRadius: 5,
          padding: "2px 7px", cursor: "default", whiteSpace: "nowrap",
        }}
      >🌀 DOMAIN</div>
      {tooltipPos && (
        <HoverTooltip x={tooltipPos.x} y={tooltipPos.y}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#cc44ff", letterSpacing: 2, marginBottom: 8 }}>🌀 DOMAIN EXPANSION</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10, lineHeight: 1.2 }}>{d.name}</div>
          <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{desc}</div>
          {secondDesc && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #7744cc44", fontSize: 12, color: "#bb88ff", lineHeight: 1.6 }}>
              {secondDesc}
            </div>
          )}
        </HoverTooltip>
      )}
    </>
  );
}


// ── SynergyTag — hoverable synergy pill showing spell description ─────────────
function SynergyTag({ id }: { id: string }) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const rule = BATTLE_SYNERGY_RULES.find(r => r.id === id);
  if (!rule) return null;
  return (
    <>
      <div
        onMouseMove={ev => setHover({ x: ev.clientX, y: ev.clientY })}
        onMouseLeave={() => setHover(null)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
          color: "#44ff88", background: "rgba(0,60,30,0.75)",
          border: "1px solid #44ff8855", borderRadius: 5,
          padding: "2px 7px", cursor: "default", whiteSpace: "nowrap",
        }}
      >✦ {rule.label}</div>
      {hover && (
        <HoverTooltip x={hover.x} y={hover.y}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#44ff88", letterSpacing: 2, marginBottom: 8 }}>✦ SYNERGY ACTIVE</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10 }}>{rule.label}</div>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>Spell unlocked:</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#88ffbb", marginBottom: 6 }}>{rule.spellName}</div>
          <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{rule.spellDesc}</div>
        </HoverTooltip>
      )}
    </>
  );
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

// Supplied when the match is being played over the network. The server owns the
// state, so the board stops running its own engine and just sends intents.
export interface OnlineBinding {
  you: PlayerId;
  opponentName: string;
  state: BattleState;
  events: BattleEvent[];
  send: (intent: BattleIntent) => void;
  /** Concede the match. */
  surrender: () => void;
  /** Seconds the opponent has to reconnect, while they are away. */
  opponentAway: number | null;
}

interface Props {
  online?: OnlineBinding;
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
  isHit, isFresh, floatingDmgs, isPinned, isLunging, lungeDir = "up",
}: {
  card: BattleCard; cardDb: Record<string, CardDef>;
  selected?: boolean; targetable?: boolean; friendlyTarget?: boolean; onClick?: (ev?: React.MouseEvent) => void;
  isHit?: boolean; isFresh?: boolean; floatingDmgs?: { key: number; amount: number }[];
  isPinned?: boolean;
  isLunging?: boolean; lungeDir?: "up" | "down";
}) {
  const def = cardDb[card.defId];

  return (
    <motion.div
      onClick={(ev) => onClick?.(ev)}
      animate={{
        scale: isLunging ? [1, 1.18, 1] : isHit ? [1, 1.08, 0.95, 1] : 1,
        y: isLunging ? (lungeDir === "up" ? [0, -26, 0] : [0, 26, 0]) : 0,
        x: isFresh && card.cost >= 5 ? [0, -3, 3, -2, 2, 0] : 0,
        rotate: isLunging ? (lungeDir === "up" ? [0, -4, 0] : [0, 4, 0]) : 0,
        filter: friendlyTarget
          ? "brightness(1.2) drop-shadow(0 0 8px #4aeecc)"
          : isLunging
          ? "brightness(1.5) drop-shadow(0 0 14px #ffcc44)"
          : isHit
          ? "brightness(2.2)"
          : "brightness(1)",
      }}
      transition={isLunging
        ? { duration: 0.34, times: [0, 0.45, 1], ease: "easeOut" }
        : isHit
        ? { duration: 0.28, times: [0, 0.25, 0.7, 1] }
        : { type: "spring", stiffness: 400, damping: 22 }}
      whileHover={onClick ? { y: -8, scale: selected ? 1.1 : 1.07 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      style={{ position: "relative", cursor: onClick ? "pointer" : "default", userSelect: "none", zIndex: isLunging ? 40 : undefined }}
    >
      <CharacterCard defId={card.defId} def={def} size="xs" noHover softTilt hideInfo smallBadges
        dimmed={!friendlyTarget && !targetable && (card.exhausted || !card.canAttack || card.stunTurns > 0)}
        statsOverlay={{ name: def?.name, atk: card.atk, hp: card.currentHp, maxHp: card.maxHp }}
      />

      {/* High-cost presence — smoke wisps (5+), lightning twitches (6+), stronger at 7 */}
      {card.cost >= 5 && (
        <div style={{ position: "absolute", inset: -6, pointerEvents: "none", zIndex: 24, overflow: "visible" }}>
          {/* Smoke wisps drifting up */}
          {[0, 1, ...(card.cost >= 6 ? [2] : [])].map(i => (
            <motion.div
              key={`smoke-${i}`}
              animate={{
                y: [6, -26 - i * 6], x: [0, i % 2 === 0 ? 7 : -7, 0],
                opacity: [0, 0.28, 0], scale: [0.7, 1.5],
              }}
              transition={{ duration: 2.6 + i * 0.7, repeat: Infinity, delay: i * 0.9, ease: "easeOut" }}
              style={{
                position: "absolute", bottom: 4, left: `${22 + i * 26}%`,
                width: 16, height: 16, borderRadius: "50%",
                background: card.cost >= 7
                  ? "radial-gradient(circle, rgba(255,190,80,0.5), transparent 70%)"
                  : "radial-gradient(circle, rgba(160,140,220,0.4), transparent 70%)",
                filter: "blur(4px)",
              }}
            />
          ))}
          {/* Lightning twitches */}
          {card.cost >= 6 && [0, ...(card.cost >= 7 ? [1] : [])].map(i => (
            <motion.svg
              key={`bolt-${i}`}
              width="26" height="40" viewBox="0 0 26 40"
              animate={{ opacity: [0, 0, 0, 0.95, 0, 0, 0] }}
              transition={{ duration: 2.8 + i * 1.3, repeat: Infinity, delay: i * 1.7, times: [0, 0.62, 0.64, 0.68, 0.72, 0.74, 1] }}
              style={{
                position: "absolute",
                top: i === 0 ? -8 : "auto", bottom: i === 0 ? "auto" : -6,
                left: i === 0 ? -10 : "auto", right: i === 0 ? "auto" : -10,
                filter: "drop-shadow(0 0 5px #aaccff)",
              }}
            >
              <polyline
                points="14,0 8,14 15,16 6,32 11,20 4,18 12,2"
                fill="none" stroke="#cfe4ff" strokeWidth="1.6" strokeLinejoin="round"
              />
            </motion.svg>
          ))}
          {/* 7-cost: faint golden ember aura */}
          {card.cost >= 7 && (
            <motion.div
              animate={{ opacity: [0.12, 0.3, 0.12] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                position: "absolute", inset: 0, borderRadius: 14,
                boxShadow: "0 0 18px rgba(255,180,60,0.55), inset 0 0 10px rgba(255,180,60,0.2)",
              }}
            />
          )}
        </div>
      )}

      {/* Hit flash overlay */}
      {isHit && (
        <motion.div
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.32 }}
          style={{
            position: "absolute", inset: 0, borderRadius: 10,
            background: "radial-gradient(circle at 50% 40%, rgba(255,80,0,0.9), rgba(255,0,0,0.5))",
            pointerEvents: "none", zIndex: 26, mixBlendMode: "screen",
          }}
        />
      )}

      {/* Impact spark burst — particles fly out when hit */}
      {isHit && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 27 }}>
          {[0, 1, 2, 3, 4, 5].map(i => {
            const ang = (i / 6) * Math.PI * 2 + 0.4;
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(ang) * 34,
                  y: Math.sin(ang) * 34,
                  opacity: 0,
                  scale: 0.2,
                }}
                transition={{ duration: 0.42, ease: "easeOut" }}
                style={{
                  position: "absolute", top: "42%", left: "46%",
                  width: 5, height: 5, borderRadius: "50%",
                  background: i % 2 === 0 ? "#ffcc44" : "#ff6622",
                  boxShadow: "0 0 6px #ff8800",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Dynamic shield badge (for cards that gained hasTaunt via GRANT_BOARD_SHIELD, not from def tag) */}
      {/* Identical styling/position to CharacterCard's shield bubble at smallBadges size (bs=16) */}
      {card.hasTaunt && !def?.tags?.includes("shield") && (
        <div style={{
          position: "absolute",
          top: -(16 * 0.3) + 16 * 0.62, left: -(16 * 0.3) + 16 * 0.6,
          width: 10, height: 10, borderRadius: "50%",
          background: "linear-gradient(135deg, #1a3a6e 0%, #0a1a4a 100%)",
          border: "1.5px solid rgba(100,180,255,0.85)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 8px rgba(80,160,255,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 28, pointerEvents: "none",
        }}>
          <span style={{ fontSize: 6, lineHeight: 1 }}>🛡</span>
        </div>
      )}

      {/* Nobara Resonance pin — this card is linked; next damage echoes to its partner */}
      {isPinned && (
        <div
          style={{ position: "absolute", top: -6, right: -6, zIndex: 29 }}
          onMouseEnter={e => {
            const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".pin-tip");
            if (tip) tip.style.display = "block";
          }}
          onMouseLeave={e => {
            const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".pin-tip");
            if (tip) tip.style.display = "none";
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{
              width: 16, height: 16, borderRadius: "50%",
              background: "linear-gradient(135deg, #5a1a2e, #2a0a14)",
              border: "1.5px solid rgba(255,100,140,0.9)",
              boxShadow: "0 0 8px rgba(255,80,120,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9,
            }}
          >📌</motion.div>
          <div className="pin-tip" style={{
            display: "none", position: "absolute", bottom: 20, right: 0,
            background: "rgba(4,4,14,0.97)", border: "1px solid #6a2a3a",
            borderRadius: 8, padding: "7px 10px",
            width: 170, zIndex: 999, pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#ff88aa", marginBottom: 3 }}>📌 Resonance</div>
            <div style={{ fontSize: 9, color: "#fff", lineHeight: 1.5 }}>
              Pinned by Nobara. The next time this card or its linked partner takes damage, the other takes half that damage. One use.
            </div>
          </div>
        </div>
      )}

      {/* Entrance glow for newly placed card */}
      {isFresh && (
        <motion.div
          initial={{ opacity: 1, scale: 1.3 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{
            position: "absolute", inset: -5, borderRadius: 16,
            background: card.cost >= 5
              ? "radial-gradient(circle, rgba(255,200,50,0.95) 0%, rgba(255,100,0,0.6) 50%, transparent 75%)"
              : "radial-gradient(circle, rgba(80,200,255,0.7) 0%, rgba(50,100,255,0.3) 50%, transparent 75%)",
            pointerEvents: "none", zIndex: 27,
          }}
        />
      )}

      {/* Entrance shockwave ring — expands outward on placement */}
      {isFresh && (
        <motion.div
          initial={{ opacity: 0.9, scale: 0.4 }}
          animate={{ opacity: 0, scale: 1.8 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: card.cost >= 5 ? "3px solid rgba(255,190,60,0.9)" : "2px solid rgba(120,200,255,0.8)",
            pointerEvents: "none", zIndex: 27,
          }}
        />
      )}

      {/* Floating damage numbers */}
      <AnimatePresence>
        {floatingDmgs?.map(d => (
          <motion.div
            key={d.key}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -48, opacity: 0, scale: 1.3 }}
            exit={{}}
            transition={{ duration: 0.65, ease: "easeOut" }}
            style={{
              position: "absolute", top: "25%", left: "50%",
              transform: "translateX(-50%)",
              fontSize: d.amount >= 5 ? 18 : 14,
              fontWeight: 900,
              color: d.amount >= 5 ? "#ff2200" : "#ff6644",
              textShadow: "0 0 10px #ff0000cc, 0 2px 6px #000",
              pointerEvents: "none", zIndex: 50,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: -1,
            }}
          >
            -{d.amount}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Stun — stays visible for the whole turn the card is losing, not just while queued */}
      {(card.stunTurns > 0 || card.stunActive) && (
        <motion.div
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{
            position: "absolute", top: 3, right: 3,
            background: "#4488ff", borderRadius: 3,
            fontSize: 7, fontWeight: 900, padding: "1px 4px", color: "#fff",
            boxShadow: "0 0 8px rgba(68,136,255,0.6)", zIndex: 29,
          }}>STUN</motion.div>
      )}

      {/* Active perk-effect indicators — sit under the perk icon in the top-right */}
      {(() => {
        const marks: { label: string; color: string; title: string }[] = [];
        if ((card.reflectTurns ?? 0) > 0) marks.push({ label: `🌀${card.reflectTurns}`, color: "#66ddff", title: `Sky Warp — reflecting attacks for ${card.reflectTurns} more turn(s)` });
        if (card.redirectNext)            marks.push({ label: "👏", color: "#ffcc44", title: "Boogie Woogie: next hit will be redirected" });
        if (card.ignoreShields)           marks.push({ label: "🗡", color: "#ff8866", title: "Shield Breaker: ignoring Shields this turn" });
        if (card.silentStrike)            marks.push({ label: "💨", color: "#aaccff", title: "Projection Rush: no counter, half damage this turn" });
        if (card.splashNext)              marks.push({ label: "🌋", color: "#ff9944", title: "Maximum Meteor: next attack splashes" });
        if (card.regen)                   marks.push({ label: "☸", color: "#ccaaff", title: "Adaptation: recovers 1 HP after surviving damage" });
        if (card.rebirth)                 marks.push({ label: "♻", color: "#88ffaa", title: "Will respawn on death" });
        if (card.blocked)                 marks.push({ label: "✋", color: "#ffbb55", title: "Block: the next damage instance is nullified" });
        if (card.sentencedWith)           marks.push({ label: "⚖", color: "#ffdd88", title: "Sentenced, can only attack its bound counterpart" });
        if (card.beastDecay)              marks.push({ label: "🐗", color: "#ff7744", title: "Beast: loses 1 HP each turn" });
        if (marks.length === 0) return null;
        return (
          <div style={{
            position: "absolute", top: 15, right: 2, zIndex: 29,
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2,
            pointerEvents: "none",
          }}>
            {marks.slice(0, 3).map((m, i) => (
              <motion.div key={i}
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.25 }}
                title={m.title}
                style={{
                  fontSize: 7, fontWeight: 900, lineHeight: 1,
                  padding: "1.5px 3px", borderRadius: 3,
                  background: "rgba(6,6,16,0.88)",
                  border: `1px solid ${m.color}77`,
                  color: m.color,
                  textShadow: `0 0 6px ${m.color}88`,
                  whiteSpace: "nowrap",
                }}
              >{m.label}</motion.div>
            ))}
          </div>
        );
      })()}

      {/* Leader card crown indicator (Sukuna/Mahoraga board mode) */}
      {card.isLeaderCard && (
        <div style={{
          position: "absolute", top: 3, left: 3,
          background: "rgba(255, 165, 0, 0.9)", borderRadius: 3,
          fontSize: 9, padding: "1px 3px",
        }}>👑</div>
      )}

      {/* Targeting marks — big shield on Shield cards (must be cleared first), subtle ✕ on other legal targets */}
      {targetable && !selected && !friendlyTarget && card.hasTaunt && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [1, 1.1, 1], opacity: 1 }}
          transition={{ scale: { duration: 1.2, repeat: Infinity }, opacity: { duration: 0.2 } }}
          style={{
            position: "absolute", inset: 0, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(20,40,90,0.35)",
            pointerEvents: "none", zIndex: 25,
            fontSize: 34,
            filter: "drop-shadow(0 0 10px rgba(100,180,255,0.9))",
          }}
        >🛡</motion.div>
      )}
      {targetable && !selected && !friendlyTarget && !card.hasTaunt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.55, 0.8, 0.55] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{
            position: "absolute", inset: 0, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none", zIndex: 25,
            fontSize: 26, fontWeight: 900, color: "rgba(255,120,120,0.85)",
            textShadow: "0 0 8px rgba(255,60,60,0.5), 0 1px 3px #000",
          }}
        >✕</motion.div>
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
  card, cardDb, energy, costReduction, boardFull, isNew, onPlay,
}: {
  card: BattleCard; cardDb: Record<string, CardDef>;
  energy: number; costReduction: number;
  boardFull: boolean; isNew?: boolean;
  onPlay: () => void;
}) {
  const def = cardDb[card.defId];
  const [hovered, setHovered] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const cost = Math.max(0, card.cost - costReduction);
  const canAfford = energy >= cost;
  const playable = canAfford && !boardFull;

  return (
    <motion.div
      onClick={playable ? onPlay : undefined}
      onHoverStart={(e) => {
        setHovered(true);
        const r = (e.target as HTMLElement)?.getBoundingClientRect?.();
        if (r) setPreviewPos({ x: r.left + r.width / 2, y: r.top });
      }}
      onHoverEnd={() => { setHovered(false); setPreviewPos(null); }}
      // Newly drawn cards sweep in from the deck side rather than just appearing
      initial={isNew ? { opacity: 0, x: 90, y: 30, rotate: 14, scale: 0.7 } : false}
      animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      whileHover={playable ? { y: -18, scale: 1.12 } : { y: -3 }}
      whileTap={playable ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      style={{
        position: "relative", userSelect: "none", flexShrink: 0,
        cursor: playable ? "pointer" : "not-allowed",
        zIndex: hovered ? 30 : 1,
      }}
    >
      {/* Playable ring — Hearthstone's "you can cast this" cue */}
      {playable && (
        <motion.div
          animate={{ opacity: [0.45, 0.9, 0.45] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none", zIndex: 0,
            boxShadow: `0 0 0 2px ${COLOR.hpGood}aa, 0 0 18px ${COLOR.hpGood}66`,
          }}
        />
      )}

      <CharacterCard defId={card.defId} def={def} size="sm" dimmed={!canAfford} hideInfo
        costOverride={cost}
        statsOverlay={{ name: def?.name, atk: card.atk, hp: card.currentHp, maxHp: card.maxHp }}
      />

      {/* Why it can't be played right now */}
      {canAfford && boardFull && (
        <div style={{
          position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center",
          fontSize: 7, fontWeight: 900, letterSpacing: 1, color: "#ffbb55",
          background: "rgba(4,4,12,0.85)", padding: "2px 0", pointerEvents: "none",
        }}>BOARD FULL</div>
      )}

      {/* Enlarged read of the card while hovering, portaled clear of the hand row */}
      {hovered && previewPos && def && createPortal(
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.14 }}
          style={{
            position: "fixed",
            // Framer Motion owns this element's transform, so anchor it with
            // plain left/top maths instead: centred on the card, sitting well
            // above the hand row (lg card is 168x238).
            left: Math.max(12, Math.min(previewPos.x - 84, window.innerWidth - 180)),
            top: Math.max(10, previewPos.y - 238 - 46),
            pointerEvents: "none", zIndex: 9998,
            filter: "drop-shadow(0 12px 34px rgba(0,0,0,0.85))",
          }}
        >
          <CharacterCard defId={card.defId} def={def} size="lg" noHover
            costOverride={cost}
            statsOverlay={{ name: def?.name, atk: card.atk, hp: card.currentHp, maxHp: card.maxHp }}
          />
        </motion.div>,
        document.body
      )}
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
  const needsTarget = effKind === "DAMAGE_TARGET" || effKind === "STUN_ONE" || effKind === "PURPLE" || effKind === "SHEEPIFY_ONE" || effKind === "DAMAGE_AND_STUN" || effKind === "BEASTIFY_ONE";
  const needsOwnTarget = effKind === "BUFF_ONE_HP" || effKind === "BUFF_ONE_ATK" || effKind === "BUFF_ONE_BOTH";
  const color = effKind === "DAMAGE_TARGET" ? "#ff6644"
    : effKind === "DAMAGE_ALL"      ? "#ff4466"
    : effKind === "DAMAGE_AND_STUN" ? "#cc88ff"
    : effKind === "BUFF_ONE_BOTH"   ? "#66ffcc"
    : effKind === "BUFF_BOARD_ATK" ? "#ffcc00"
    : effKind === "BUFF_BOARD_HP"  ? "#44ff88"
    : effKind === "BUFF_ONE_ATK"   ? "#ffaa44"
    : effKind === "BUFF_ONE_HP"    ? "#44ffaa"
    : effKind === "DRAW"           ? "#4488ff"
    : effKind === "GAIN_ENERGY"    ? "#4aeecc"
    : effKind === "PURPLE"         ? "#bb44ff"
    : effKind === "SHEEPIFY_ONE"   ? "#88ff88"
    : effKind === "BEASTIFY_ONE"   ? "#ff9944"
    : effKind === "DESTROY_ONE"    ? "#ff44aa"
    : effKind === "COPY_BOARD_CARD"     ? "#44ddff"
    : effKind === "DAMAGE_TARGET_SELF"  ? "#ff6600"
    : "#cc44ff";
  const icon = effKind === "DAMAGE_TARGET" ? "💥" : effKind === "DAMAGE_ALL" ? "☄" : effKind === "DAMAGE_AND_STUN" ? "🌀" : effKind === "BUFF_ONE_BOTH" ? "✨" : effKind === "BUFF_BOARD_ATK" ? "⚔" : effKind === "BUFF_BOARD_HP" ? "💚" : effKind === "BUFF_ONE_ATK" ? "🗡" : effKind === "BUFF_ONE_HP" ? "💉" : effKind === "DRAW" ? "🃏" : effKind === "GAIN_ENERGY" ? "⚡" : effKind === "PURPLE" ? "🌌" : effKind === "DESTROY_ONE" ? "🗑" : effKind === "COPY_BOARD_CARD" ? "📋" : effKind === "DAMAGE_TARGET_SELF" ? "⚡" : effKind === "SHEEPIFY_ONE" ? "🐑" : effKind === "BEASTIFY_ONE" ? "🐗" : "❄";

  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { y: -12, scale: 1.06 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      animate={active ? { boxShadow: [`0 0 0 2px ${color}, 0 0 18px ${color}88`, `0 0 0 2px ${color}, 0 0 32px ${color}cc`] } : {}}
      transition={{ duration: 0.6, repeat: active ? Infinity : 0, repeatType: "reverse" }}
      style={{
        width: 116, borderRadius: 12, padding: "14px 12px",
        background: `linear-gradient(180deg, ${color}22, rgba(4,4,12,0.97))`,
        border: `1px solid ${color}66`,
        cursor: onClick ? "pointer" : "default",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
        userSelect: "none", flexShrink: 0,
        boxShadow: `0 6px 20px rgba(0,0,0,0.7), 0 0 14px ${color}28`,
        position: "relative",
      }}
    >
      {/* Single target heals also cleanse; the info circle explains it on hover */}
      {effKind === "BUFF_ONE_HP" && (
        <div
          style={{ position: "absolute", top: 5, right: 5, zIndex: 5 }}
          onMouseEnter={e => {
            const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".cleanse-tip");
            if (tip) tip.style.display = "block";
          }}
          onMouseLeave={e => {
            const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".cleanse-tip");
            if (tip) tip.style.display = "none";
          }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: "50%",
            background: "linear-gradient(135deg, #103a24, #072414)",
            border: "1.5px solid rgba(90,230,160,0.8)",
            boxShadow: "0 0 6px rgba(80,220,150,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, lineHeight: 1,
          }}>✚</div>
          <div className="cleanse-tip" style={{
            display: "none", position: "absolute", bottom: 22, right: -4,
            background: "rgba(4,4,14,0.97)", border: "1px solid #2a5a3a",
            borderRadius: 8, padding: "7px 10px",
            width: 180, zIndex: 999, pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#66ffaa", marginBottom: 3 }}>✚ Cleanse</div>
            <div style={{ fontSize: 9, color: "#fff", lineHeight: 1.5 }}>
              Also removes negative effects from the target, such as Stun and Sheep.
            </div>
          </div>
        </div>
      )}
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 900, color, letterSpacing: 0.5, textAlign: "center", lineHeight: 1.3 }}>
        {spell.name}
      </div>
      <div style={{ fontSize: 10, color: `${color}cc`, textAlign: "center", lineHeight: 1.5 }}>
        {spell.description}
      </div>
      {needsTarget && onClick && (
        <div style={{ fontSize: 9, color: "#ffcc00", letterSpacing: 1, fontWeight: 900, marginTop: 2 }}>▶ TARGET</div>
      )}
      {needsOwnTarget && onClick && (
        <div style={{ fontSize: 9, color: "#88ffcc", letterSpacing: 1, fontWeight: 900, marginTop: 2 }}>▶ PICK CARD</div>
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
  isTop, domainBadgeDefId, isVacant, isHit,
}: {
  leader: BattleCard; cardDb: Record<string, CardDef>;
  playerName: string; playerIcon: string;
  selected?: boolean; targetable?: boolean;
  energy?: number; maxEnergy?: number;
  domainMeter?: number; showDomainBtn?: boolean;
  onSelect?: () => void; onDomainActivate?: () => void;
  isTop: boolean; domainBadgeDefId?: string; isVacant?: boolean; isHit?: boolean;
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
      {/* Name + icon row (always above card for isTop, always below for bottom player) */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
          <PlayerIcon icon={playerIcon} size={22} style={{ display: "block" }} />
        </div>
        <span style={{ fontSize: 10, color: "#778", letterSpacing: 1, fontWeight: 600 }}>{playerName}</span>
        {/* Stats shown inline with name only for bottom player; top player gets them below the card */}
        {!isTop && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "2px 8px",
            border: `1px solid ${hpColor}44`,
          }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: "#ff8855" }}>⚔{leader.atk}</span>
            <span style={{ fontSize: 10, color: "#334" }}>·</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: hpColor }}>♥{leader.currentHp}/{leader.maxHp}</span>
          </div>
        )}
        {leader.stunTurns > 0 && (
          <div style={{ background: "#4488ff", borderRadius: 4, fontSize: 8, fontWeight: 900, padding: "1px 6px", color: "#fff" }}>
            STUN
          </div>
        )}
      </div>

      {/* Leader card + rings (+ right-side stats for top player) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Energy/Domain panel — only for active player, shown to the left of their leader */}
        {isActivePlayer && !isTop && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 110 }}>
            {/* Energy header */}
            <div style={{ fontSize: 9, color: "#4aeecc", fontWeight: 800, letterSpacing: 1 }}>
              ⚡ ENERGY {energy}/{maxEnergy}
            </div>

            {/* Crystal grid — always 10 slots; filled = available, empty = spent, locked = not yet unlocked */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
              {Array.from({ length: 10 }).map((_, i) => {
                const unlocked = i < (maxEnergy ?? 0);
                const filled   = i < (energy ?? 0);
                return (
                  <motion.div
                    key={i}
                    animate={filled ? { boxShadow: ["0 0 4px #4aeecc66", "0 0 10px #4aeecc", "0 0 4px #4aeecc66"] } : {}}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.07 }}
                    style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: filled
                        ? "linear-gradient(135deg, #2af 0%, #4aeecc 100%)"
                        : unlocked
                        ? "#111820"
                        : "#07070e",
                      border: `1px solid ${filled ? "#4aeecc" : unlocked ? "#1e2e38" : "#111116"}`,
                      opacity: unlocked ? 1 : 0.35,
                      transition: "background 0.2s, border-color 0.2s",
                    }}
                  />
                );
              })}
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

        {/* The leader card itself (or vacant slot) */}
        {isVacant ? (
          <div style={{
            width: 92, height: 130, borderRadius: 8,
            border: "2px dashed #331144", background: "rgba(20,0,40,0.5)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <div style={{ fontSize: 18, opacity: 0.4 }}>⚔</div>
            <div style={{ fontSize: 7, color: "#553377", fontWeight: 900, letterSpacing: 1, textAlign: "center" }}>VACANT<br/>ON BOARD</div>
          </div>
        ) : (
        <motion.div
          onClick={onSelect}
          animate={isHit ? { scale: [1, 1.06, 0.97, 1], filter: ["brightness(1)", "brightness(2.4)", "brightness(1)"] } : { scale: 1 }}
          transition={isHit ? { duration: 0.28, times: [0, 0.2, 0.65, 1] } : { type: "spring", stiffness: 400, damping: 22 }}
          whileHover={onSelect ? { scale: 1.07, y: isTop ? 4 : -4 } : undefined}
          whileTap={onSelect ? { scale: 0.96 } : undefined}
          style={{ position: "relative", cursor: onSelect ? "pointer" : "default", userSelect: "none" }}
        >
          <CharacterCard defId={leader.defId} def={def} size="sm" hideAffinityAndCost />

          {/* Hit flash overlay */}
          <AnimatePresence>
            {isHit && (
              <motion.div key="leader-hit"
                initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.32 }}
                style={{ position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none", zIndex: 26, mixBlendMode: "screen",
                  background: "radial-gradient(circle at 50% 40%, rgba(255,60,0,0.95), rgba(255,0,0,0.55))" }} />
            )}
          </AnimatePresence>

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


          {/* Target ring */}
          {targetable && !selected && (
            <motion.div
              animate={{ boxShadow: ["0 0 0 3px #ff4444, 0 0 16px #ff444477", "0 0 0 3px #ff6666, 0 0 26px #ff4444aa"] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              style={{ position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none" }}
            />
          )}
        </motion.div>
        )}{/* end isVacant conditional */}

        {/* Stats + domain badge to the RIGHT of card — only for top player */}
        {isTop && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
            {!isVacant ? (
              <div style={{
                display: "flex", flexDirection: "column", gap: 4,
                background: "rgba(0,0,0,0.6)", borderRadius: 8, padding: "8px 12px",
                border: `1px solid ${hpColor}55`,
              }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#ff8855" }}>⚔ {leader.atk}</span>
                <div style={{ width: "100%", height: 1, background: "#222" }} />
                <span style={{ fontSize: 15, fontWeight: 900, color: hpColor }}>♥ {leader.currentHp}<span style={{ fontSize: 10, color: "#556", fontWeight: 600 }}>/{leader.maxHp}</span></span>
              </div>
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", gap: 4,
                background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "8px 12px",
                border: "1px solid #33334455",
              }}>
                <span style={{ fontSize: 11, color: "#444", fontWeight: 700, letterSpacing: 1 }}>ON BOARD</span>
              </div>
            )}
            {domainBadgeDefId && <DomainBadge defId={domainBadgeDefId} />}
          </div>
        )}

        {/* Spacer to balance the energy panel on the other side */}
        {isActivePlayer && !isTop && <div style={{ width: 110 }} />}
      </div>
    </div>
  );
}

// ── LeaderRightPanel — player's leader shown as a right-column panel ──────────
function LeaderRightPanel({
  leader, cardDb, playerName, playerIcon,
  isVacant, isHit, leaderShields = 0,
  domainMeter, domainCooldown, onDomainActivate,
  onSelect,
}: {
  leader: BattleCard; cardDb: Record<string, CardDef>;
  playerName: string; playerIcon: string;
  selected?: boolean; isVacant?: boolean; isHit?: boolean; leaderShields?: number;
  domainMeter?: number; domainCooldown?: number; onDomainActivate?: () => void;
  onSelect: (ev?: React.MouseEvent) => void;
}) {
  const def = cardDb[leader.defId];
  const hpPct   = Math.max(0, Math.min(100, (leader.currentHp / leader.maxHp) * 100));
  const hpColor = hpPct > 50 ? "#44ff88" : hpPct > 25 ? "#ffcc00" : "#ff4444";
  const meterFull = (domainMeter ?? 0) >= 100;

  return (
    <div style={{
      width: LEADER_PANEL_WIDTH, flexShrink: 0, position: "relative",
      background: "rgba(4,4,16,0.88)", borderLeft: "1px solid #111128",
      display: "flex", flexDirection: "row", alignItems: "stretch",
      justifyContent: "center",
    }}>
      {/* Domain column on the left */}
      {domainMeter !== undefined && (
        <div style={{
          width: 77, flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6,
          padding: "10px 5px", borderRight: "1px solid #111128",
        }}>
          <DomainBadge defId={leader.defId} />
          {/* Vertical meter bar */}
          <div style={{ width: 12, height: 72, background: "#111", borderRadius: 5, overflow: "hidden", position: "relative" }}>
            <motion.div
              animate={{ height: `${domainMeter}%` }}
              transition={{ duration: 0.4 }}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: meterFull ? "#c88fff" : "#4455aa", borderRadius: 5 }}
            />
          </div>
          {meterFull && domainCooldown === 0 && (
            <motion.button
              onClick={onDomainActivate}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
              style={{
                fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
                background: "linear-gradient(135deg,#7733cc,#c88fff)",
                border: "none", borderRadius: 5, color: "#fff",
                padding: "4px 6px", cursor: "pointer", textAlign: "center",
              }}
            >Activate</motion.button>
          )}
          {meterFull && (domainCooldown ?? 0) > 0 && (
            <div style={{ fontSize: 8, color: "#c88fff", textAlign: "center", fontWeight: 700 }}>
              CD:{domainCooldown}T
            </div>
          )}
        </div>
      )}

      {/* Leader Block pip */}
      {leader.blocked && (
        <motion.div
          animate={{ opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          title="Block: the next damage instance is nullified"
          style={{
            position: "absolute", top: 6, left: 8, zIndex: 40,
            width: 20, height: 20, borderRadius: "50%",
            background: "linear-gradient(135deg, #4a3410, #2a1c06)",
            border: "1.5px solid rgba(255,180,80,0.9)",
            boxShadow: "0 0 8px rgba(255,170,60,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
          }}
        >✋</motion.div>
      )}

      {/* Leader shields — each nullifies one instance of damage */}
      {leaderShields > 0 && (
        <div
          style={{ position: "absolute", top: 6, right: 8, zIndex: 40, display: "flex", gap: 3 }}
          onMouseEnter={e => {
            const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".ls-tip");
            if (tip) tip.style.display = "block";
          }}
          onMouseLeave={e => {
            const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".ls-tip");
            if (tip) tip.style.display = "none";
          }}
        >
          {Array.from({ length: Math.min(leaderShields, 5) }).map((_, i) => (
            <motion.div key={i}
              animate={{ opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}
              style={{
                width: 18, height: 18, borderRadius: "50%",
                background: "linear-gradient(135deg, #1a3a6e, #0a1a4a)",
                border: "1.5px solid rgba(120,200,255,0.9)",
                boxShadow: "0 0 8px rgba(90,170,255,0.65)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
              }}
            >🛡</motion.div>
          ))}
          {leaderShields > 5 && (
            <div style={{ fontSize: 10, fontWeight: 900, color: "#88bbff", alignSelf: "center" }}>+{leaderShields - 5}</div>
          )}
          <div className="ls-tip" style={{
            display: "none", position: "absolute", top: 24, right: 0,
            background: "rgba(4,4,14,0.98)", border: "1px solid #2a3a6a",
            borderRadius: 8, padding: "7px 10px", width: 180, zIndex: 999,
            pointerEvents: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#88bbff", marginBottom: 3 }}>🛡 Leader Shields ×{leaderShields}</div>
            <div style={{ fontSize: 9, color: "#fff", lineHeight: 1.5 }}>
              Each shield completely nullifies the next instance of damage to your leader. They stack.
            </div>
          </div>
        </div>
      )}

      {/* Card + info column */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 12px", gap: 8, justifyContent: "center",
      }}>
      {/* Player name + icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
        <div style={{ borderRadius: 5, overflow: "hidden", border: "1px solid #333", flexShrink: 0 }}>
          <PlayerIcon icon={playerIcon} size={26} style={{ display: "block" }} />
        </div>
        <span style={{ fontSize: 11, color: "#778", letterSpacing: 1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{playerName}</span>
      </div>

      {/* Leader card (or vacant slot when on board) */}
      {isVacant ? (
        <div style={{
          width: 130, height: 175, borderRadius: 8,
          border: "2px dashed #331144", background: "rgba(20,0,40,0.5)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          <div style={{ fontSize: 22, opacity: 0.4 }}>⚔</div>
          <div style={{ fontSize: 8, color: "#553377", fontWeight: 900, letterSpacing: 1, textAlign: "center" }}>VACANT<br/>ON BOARD</div>
        </div>
      ) : (
      <motion.div
        onClick={onSelect}
        animate={isHit ? { scale: [1, 1.06, 0.97, 1], filter: ["brightness(1)", "brightness(2.4)", "brightness(1)"] } : { scale: 1 }}
        transition={isHit ? { duration: 0.28, times: [0, 0.2, 0.65, 1] } : { type: "spring", stiffness: 400, damping: 22 }}
        whileHover={{ scale: 1.06, y: -4 }}
        whileTap={{ scale: 0.96 }}
        style={{ position: "relative", cursor: "pointer", userSelect: "none" }}
      >
        <CharacterCard defId={leader.defId} def={def} size="lg" hideAffinityAndCost />

        {/* Hit flash overlay */}
        <AnimatePresence>
          {isHit && (
            <motion.div key="panel-leader-hit"
              initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.32 }}
              style={{ position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none", zIndex: 26, mixBlendMode: "screen",
                background: "radial-gradient(circle at 50% 40%, rgba(255,60,0,0.95), rgba(255,0,0,0.55))" }} />
          )}
        </AnimatePresence>

        <div style={{
          position: "absolute", top: 5, left: 5,
          fontSize: 8, fontWeight: 900, letterSpacing: 1,
          background: "rgba(255,200,0,0.88)", color: "#000",
          padding: "1px 7px", borderRadius: 3,
        }}>LEADER</div>
        {/* HP bar */}
        <div style={{ position: "absolute", bottom: 3, left: 5, right: 5, height: 5, background: "#111", borderRadius: 2 }}>
          <motion.div animate={{ width: `${hpPct}%` }} transition={{ duration: 0.35 }}
            style={{ height: "100%", background: hpColor, borderRadius: 2 }} />
        </div>
        {leader.stunTurns > 0 && (
          <div style={{ position: "absolute", top: 5, right: 5, background: "#4488ff", borderRadius: 3, fontSize: 8, fontWeight: 900, padding: "1px 5px", color: "#fff" }}>STUN</div>
        )}
      </motion.div>
      )}

      {/* Stats row (only when not vacant) */}
      {!isVacant && (
      <div style={{
        display: "flex", gap: 8, background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "5px 12px",
        border: `1px solid ${hpColor}33`, width: "100%", justifyContent: "center",
      }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: "#ff8855" }}>⚔{leader.atk}</span>
        <span style={{ fontSize: 15, color: "#334" }}>·</span>
        <span style={{ fontSize: 15, fontWeight: 900, color: hpColor }}>♥{leader.currentHp}/{leader.maxHp}</span>
      </div>
      )}
      </div>{/* end card+info column */}
    </div>
  );
}

// ── Board row (5 slots) ───────────────────────────────────────────────────────
function BoardRow({
  board, cardDb, pendingId, targeting, myBoard, cardScale = 1,
  buffTargeting = false,
  isTargetable,
  onActivatePerk, onAttackRandom, perkActiveId, pinnedIds, lungeIds,
  onSelectCard, onTargetCard,
  hitIds, freshIds, floatingDmgMap,
}: {
  board: (BattleCard | null)[];
  cardDb: Record<string, CardDef>;
  pendingId: string | null; targeting: boolean; myBoard: boolean;
  buffTargeting?: boolean;
  isTargetable?: (card: BattleCard) => boolean;
  cardScale?: number;
  onActivatePerk?: (card: BattleCard) => void;
  onAttackRandom?: (card: BattleCard) => void;
  perkActiveId?: string | null;
  pinnedIds?: Set<string>;
  lungeIds?: Set<string>;
  onSelectCard?: (id: string, ev: React.MouseEvent) => void; onTargetCard?: (id: string) => void;
  hitIds?: Set<string>; freshIds?: Set<string>;
  floatingDmgMap?: Record<string, { key: number; amount: number }[]>;
}) {
  const slotW = Math.round(72 * cardScale);
  const slotH = Math.round(103 * cardScale);
  return (
    <div style={{
      display: "flex", gap: Math.round(10 * cardScale), justifyContent: "center", alignItems: "center",
      flex: 1, minHeight: slotH + 10, padding: "0 8px",
    }}>
      {board.map((card, i) => (
        <div key={i} style={{ width: slotW, height: slotH, flexShrink: 0, position: "relative" }}>
          <AnimatePresence>
            {card && (
              /* Outer motion.div handles entrance/exit — no CSS transform here so framer owns it */
              <motion.div
                key={card.instanceId}
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.45, filter: "brightness(3.5) saturate(0)", transition: { duration: 0.2, ease: "easeOut" } }}
                transition={{ type: "spring", stiffness: 480, damping: 30 }}
                style={{ position: "absolute", top: 0, left: 0, width: slotW, height: slotH, transformOrigin: "top left" }}
              >
                {/* Inner div applies the cardScale independently of framer animation */}
                <div style={{ transform: `scale(${cardScale})`, transformOrigin: "top left", width: 72, height: 103 }}>
                  <BoardCardView
                    card={card} cardDb={cardDb}
                    selected={pendingId === card.instanceId}
                    targetable={targeting && !myBoard && (isTargetable ? isTargetable(card) : true)}
                    friendlyTarget={buffTargeting === true && myBoard}
                    isHit={hitIds?.has(card.instanceId)}
                    isFresh={freshIds?.has(card.instanceId)}
                    floatingDmgs={floatingDmgMap?.[card.instanceId]}
                    isPinned={pinnedIds?.has(card.instanceId)}
                    isLunging={lungeIds?.has(card.instanceId)}
                    lungeDir={myBoard ? "up" : "down"}
                    onClick={(ev) => {
                      if (myBoard && onSelectCard) onSelectCard(card.instanceId, ev!);
                      else if (!myBoard && onTargetCard) onTargetCard(card.instanceId);
                    }}
                  />
                </div>
                {/* Perk activation button — centered right under the card */}
                {myBoard && onActivatePerk && CARD_PERKS[card.defId] && !card.perkUsed && (
                  <div style={{
                    position: "absolute", top: slotH + 2, left: 0, width: slotW,
                    display: "flex", justifyContent: "center", zIndex: 30,
                  }}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={(e) => { e.stopPropagation(); onActivatePerk(card); }}
                      style={{
                        padding: "2px 8px", borderRadius: 6,
                        background: perkActiveId === card.instanceId
                          ? "linear-gradient(135deg, #ffcc44, #cc8800)"
                          : "linear-gradient(135deg, rgba(90,60,0,0.9), rgba(40,26,0,0.9))",
                        border: `1px solid ${perkActiveId === card.instanceId ? "#ffe088" : "#ffcc4466"}`,
                        color: perkActiveId === card.instanceId ? "#000" : "#ffcc44",
                        fontSize: 8, fontWeight: 900, letterSpacing: 1,
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "0 0 8px rgba(255,190,40,0.3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {CARD_PERKS[card.defId].icon} PERK
                    </motion.button>
                  </div>
                )}
                {/* Mahoraga ATTACK button — replaces the perk button once his perk is used */}
                {myBoard && onAttackRandom
                  && (card.defId === "mahoraga" || card.defId === "mahoraga-entity")
                  && (card.defId === "mahoraga-entity" || card.perkUsed)
                  && card.canAttack && !card.exhausted && (
                  <div
                    style={{
                      position: "absolute", top: slotH + 2, left: 0, width: slotW,
                      display: "flex", justifyContent: "center", zIndex: 30,
                    }}
                    onMouseEnter={e => {
                      const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".maho-atk-tip");
                      if (tip) tip.style.display = "block";
                    }}
                    onMouseLeave={e => {
                      const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".maho-atk-tip");
                      if (tip) tip.style.display = "none";
                    }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={(e) => { e.stopPropagation(); onAttackRandom(card); }}
                      style={{
                        padding: "2px 10px", borderRadius: 6,
                        background: "linear-gradient(135deg, rgba(120,20,20,0.92), rgba(60,8,8,0.92))",
                        border: "1px solid #ff555577",
                        color: "#ff7766", fontSize: 8, fontWeight: 900, letterSpacing: 1,
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "0 0 8px rgba(255,60,60,0.3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ⚔ ATTACK
                    </motion.button>
                    <div className="maho-atk-tip" style={{
                      display: "none", position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
                      background: "rgba(4,4,14,0.98)", border: "1px solid #6a2a2a",
                      borderRadius: 8, padding: "7px 10px",
                      width: 180, zIndex: 999, pointerEvents: "none",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: "#ff7766", marginBottom: 3 }}>☸ Wild Strike</div>
                      <div style={{ fontSize: 9, color: "#fff", lineHeight: 1.5 }}>
                        Mahoraga attacks a RANDOM target on the board — friend or foe, card or leader. The wheel decides.
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {/* Empty slots are invisible — the board just looks open until a card lands */}
          {!card && (
            <div style={{ width: slotW, height: slotH }} />
          )}
        </div>
      ))}
    </div>
  );
}

// Right-hand column of the player's row: domain orb (130) + leader panel (252) + gutter (40).
// A spacer of the same width sits on the left so the board row stays centred on screen.
const DOMAIN_ORB_WIDTH = 130;
const LEADER_PANEL_WIDTH = 252;
const RIGHT_COLUMN_GUTTER = 40;
const RIGHT_COLUMN_WIDTH = DOMAIN_ORB_WIDTH + LEADER_PANEL_WIDTH + RIGHT_COLUMN_GUTTER;

// ── DomainOrb — big status circle between board and leader; click to activate ──
function DomainOrb({
  meter, cooldown, leaderId, onActivate,
}: {
  meter: number; cooldown: number; leaderId: string; onActivate: () => void;
}) {
  const ready = meter >= 100 && cooldown === 0;
  // When it's ready to fire, the orb previews the colour the arena will turn.
  const dc = DOMAIN_COLOR[leaderId] ?? DEFAULT_DOMAIN_COLOR;
  const pct = Math.min(100, Math.round(meter));
  const size = 104;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      width: DOMAIN_ORB_WIDTH, flexShrink: 0, position: "relative", zIndex: 3,
    }}>
      <motion.div
        onClick={ready ? onActivate : undefined}
        whileHover={ready ? { scale: 1.08 } : {}}
        whileTap={ready ? { scale: 0.94 } : {}}
        animate={ready
          ? { boxShadow: [
              `0 0 24px ${dc}88, 0 0 60px ${dc}33, inset 0 0 26px ${dc}44`,
              `0 0 44px ${dc}cc, 0 0 90px ${dc}55, inset 0 0 34px ${dc}66`,
              `0 0 24px ${dc}88, 0 0 60px ${dc}33, inset 0 0 26px ${dc}44`,
            ] }
          : {}}
        transition={ready ? { duration: 1.4, repeat: Infinity } : {}}
        style={{
          width: size, height: size, borderRadius: "50%",
          cursor: ready ? "pointer" : "default",
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: ready
            ? `radial-gradient(circle at 50% 38%, ${dc}33, #12041f 70%)`
            : cooldown > 0
            ? "radial-gradient(circle at 50% 38%, #16161f, #0a0a12 70%)"
            : "radial-gradient(circle at 50% 38%, #1d1030, #0c0618 70%)",
          border: ready ? `2px solid ${dc}cc` : "2px solid rgba(140,110,200,0.25)",
          boxShadow: ready ? undefined : "0 4px 18px rgba(0,0,0,0.6), inset 0 0 18px rgba(90,50,160,0.15)",
          userSelect: "none",
        }}
      >
        {/* Charging progress ring */}
        {!ready && cooldown === 0 && (
          <div style={{
            position: "absolute", inset: -2, borderRadius: "50%",
            background: `conic-gradient(#8a44dd ${pct * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
            WebkitMask: "radial-gradient(circle, transparent 62%, #000 64%)",
            mask: "radial-gradient(circle, transparent 62%, #000 64%)",
            pointerEvents: "none",
          }} />
        )}
        {/* Ready: slow rotating outer ring */}
        {ready && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: `2px dashed ${dc}88`,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Ready: floating particles */}
        {ready && [0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            animate={{
              y: [0, -14, 0], opacity: [0.3, 0.9, 0.3],
            }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.45 }}
            style={{
              position: "absolute",
              left: `${18 + i * 20}%`, bottom: "12%",
              width: 4, height: 4, borderRadius: "50%",
              background: dc, boxShadow: `0 0 8px ${dc}`,
              pointerEvents: "none",
            }}
          />
        ))}
        <div style={{ textAlign: "center", lineHeight: 1.25, pointerEvents: "none" }}>
          {ready ? (
            <>
              <motion.div
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ fontSize: 24, marginBottom: 2 }}
              >🌀</motion.div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#fff", textShadow: `0 0 12px ${dc}` }}>
                DOMAIN<br/>READY
              </div>
            </>
          ) : cooldown > 0 ? (
            <>
              <div style={{ fontSize: 20, marginBottom: 2, opacity: 0.45 }}>⏳</div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: "#555a70" }}>
                COOLDOWN<br/>{cooldown} TURN{cooldown > 1 ? "S" : ""}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, marginBottom: 2, opacity: 0.7 }}>🌀</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#a98ad4" }}>{pct}%</div>
              <div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 2, color: "#6a5a8a" }}>DOMAIN</div>
            </>
          )}
        </div>
      </motion.div>
      {ready && (
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ marginTop: 6, fontSize: 8, fontWeight: 900, letterSpacing: 2, color: dc }}
        >CLICK TO UNLEASH</motion.div>
      )}
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
  online,
  p1Draft, p2Draft, cardDb,
  p1Name, p2Name, p1Icon, p2Icon,
  onGameOver,
}: Props) {
  // Mulligan phase: players swap cards before battle starts
  type MulliganStep = "P1" | "P2" | "BATTLE";
  type MulliganSubPhase = "SELECT" | "REPLACED";
  const isOnline = !!online;
  // Online matches are already dealt by the server, so there is no local mulligan
  const [mulliganStep, setMulliganStep] = useState<MulliganStep>(isOnline ? "BATTLE" : "P1");
  const [mulliganSubPhase, setMulliganSubPhase] = useState<MulliganSubPhase>("SELECT");
  const [mulliganReturning, setMulliganReturning] = useState<Set<string>>(new Set());
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
  const [goSecondSpellHover, setGoSecondSpellHover] = useState<{ x: number; y: number } | null>(null);

  const [initialState] = useState(() => createBattleState(p1Draft, p2Draft, cardDb));
  const [engine] = useState(() => createBattleEngine(initialState));
  const [localState, setLocalState] = useState<BattleState>(() => engine.getState());
  // Online the server is the only source of truth; locally we run our own engine
  const battleState = online ? online.state : localState;
  const setBattleState = setLocalState;
  const [domainFlash, setDomainFlash] = useState<string | null>(null);
  const [gameOverShown, setGameOverShown] = useState(false);
  const [pendingSpellId, setPendingSpellId] = useState<string | null>(null); // spell awaiting enemy target
  const [buffOneTargeting, setBuffOneTargeting] = useState<string | null>(null); // spell id for BUFF_ONE (own-card target)
  const [turnBackTargeting, setTurnBackTargeting] = useState(false);
  // Whose side of the table we are rendering. Online this is your seat and never
  // moves. Locally it swaps at the handoff, so the player about to act is always
  // the one at the bottom and the other player's hand stays hidden up top.
  const [localViewer, setLocalViewer] = useState<PlayerId>("P1");
  // Online your seat never changes. Locally it swaps at the handoff.
  const viewer = online ? online.you : localViewer;
  const setViewer = setLocalViewer;
  // Set when the turn passes locally, cleared once the next player taps ready.
  const [handoffTo, setHandoffTo] = useState<PlayerId | null>(null);
  const [pendingShieldGrant, setPendingShieldGrant] = useState(false);
  const [pendingBlockGrant, setPendingBlockGrant] = useState(false);
  // Perk activation flow — Mahito needs two targets (enemy first, then same-cost friendly)
  const [pendingPerk, setPendingPerk] = useState<{ instanceId: string; defId: string; enemyTargetId?: string } | null>(null);
  const [drewCardId, setDrewCardId] = useState<string | null>(null); // card drawn this turn (for animation)
  const [attackLineStart, setAttackLineStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Mahoraga aiming: the arrow twitches toward random spots instead of following the mouse
  const [twitchPos, setTwitchPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mahoragaAiming = (() => {
    if (!battleState.pendingAttackerId) return false;
    const pl = battleState.players[battleState.activePlayer];
    // Only his board form strikes wildly. As a leader in the portrait slot he aims normally.
    const c = pl.board.find(b => b?.instanceId === battleState.pendingAttackerId);
    return c?.defId === "mahoraga" || c?.defId === "mahoraga-entity";
  })();
  useEffect(() => {
    if (!mahoragaAiming) return;
    const jump = () => setTwitchPos({
      x: window.innerWidth * (0.15 + Math.random() * 0.7),
      y: window.innerHeight * (0.12 + Math.random() * 0.65),
    });
    jump();
    const iv = setInterval(jump, 220);
    return () => clearInterval(iv);
  }, [mahoragaAiming]);

  // ── Visual effect states ──────────────────────────────────────────────────
  const [hitIds, setHitIds] = useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [floatingDmgMap, setFloatingDmgMap] = useState<Record<string, { key: number; amount: number }[]>>({});
  const [leaderHitPid, setLeaderHitPid] = useState<PlayerId | null>(null);
  const [lungeIds, setLungeIds] = useState<Set<string>>(new Set());
  const [spellFlash, setSpellFlash] = useState<{ key: number; name: string } | null>(null);
  const [turnBanner, setTurnBanner] = useState<{ key: number; pid: PlayerId } | null>(null);
  const shakeControls = useAnimationControls();
  const dmgKeyRef = useRef(0);
  // Rolling readout of recent events, TFT style
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  // Brief slow-motion on heavy hits — "hit stop" borrowed from fighting games,
  // which is what makes a big Hearthstone swing land so hard
  const [hitStop, setHitStop] = useState(false);

  const pushLog = useCallback((entry: Omit<LogEntry, "id">) => {
    const id = ++dmgKeyRef.current;
    setLogEntries(prev => [...prev.slice(-5), { ...entry, id }]);
    setTimeout(() => setLogEntries(prev => prev.filter(e => e.id !== id)), 5200);
  }, []);

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

  // Drives every animation off the engine's event stream. Local matches call this
  // right after applying an intent, online matches call it when the server sends
  // events down. `before` is the state as it was, so dead cards can still be named.
  const playEvents = useCallback((events: BattleEvent[], before: BattleState) => {
    const nameOf = (id: string): string => {
      for (const pl of [before.players.P1, before.players.P2]) {
        if (pl.leader.instanceId === id) return pl.leader.name;
        const c = pl.board.find(b => b?.instanceId === id);
        if (c) return c.name;
      }
      return "a card";
    };
    for (const ev of events) {
      if (ev.type === "DOMAIN_ACTIVATED") {
        setDomainFlash(ev.name);
        pushLog({ pid: ev.pid, icon: "🌀", text: ev.name, tone: "domain" });
      }
      if (ev.type === "SPELL_CAST") pushLog({ pid: ev.pid, icon: "✦", text: "Spell cast", tone: "spell" });
      if (ev.type === "CARD_DIED") pushLog({ pid: ev.pid, icon: "💀", text: `${nameOf(ev.instanceId)} destroyed`, tone: "death" });
      if (ev.type === "TURN_START" && ev.drew) { setDrewCardId(ev.drew); setTimeout(() => setDrewCardId(null), 700); }
      if (ev.type === "GAME_OVER") { setGameOverShown(true); return; }

      if (ev.type === "ATTACK_CARD") {
        const addHit = (id: string) => {
          setHitIds(p => new Set([...p, id]));
          setTimeout(() => setHitIds(p => { const n = new Set(p); n.delete(id); return n; }), 380);
        };
        const addDmg = (id: string, amount: number) => {
          const key = ++dmgKeyRef.current;
          setFloatingDmgMap(p => ({ ...p, [id]: [...(p[id] ?? []), { key, amount }] }));
          setTimeout(() => setFloatingDmgMap(p => ({ ...p, [id]: (p[id] ?? []).filter(d => d.key !== key) })), 750);
        };
        // Attacker lunges toward the target before the impact lands
        setLungeIds(p => new Set([...p, ev.attackerId]));
        setTimeout(() => setLungeIds(p => { const n = new Set(p); n.delete(ev.attackerId); return n; }), 380);
        addHit(ev.targetId);
        addDmg(ev.targetId, ev.damage);
        if (ev.counterDamage > 0) { addHit(ev.attackerId); addDmg(ev.attackerId, ev.counterDamage); }
        pushLog({
          pid: ev.attackerPid, icon: "⚔",
          text: `${nameOf(ev.attackerId)} hits ${nameOf(ev.targetId)} for ${ev.damage}`,
          tone: "attack",
        });
        // Heavy blows briefly stall the frame so the impact reads
        if (ev.damage >= 6) {
          setHitStop(true);
          setTimeout(() => setHitStop(false), 110);
        }
      }

      if (ev.type === "ATTACK_LEADER") {
        const hitPid: PlayerId = ev.attackerPid === "P1" ? "P2" : "P1";
        setLeaderHitPid(hitPid);
        setTimeout(() => setLeaderHitPid(null), 480);
        // Attacker lunge + screen shake scaled to the blow
        setLungeIds(p => new Set([...p, ev.attackerId]));
        setTimeout(() => setLungeIds(p => { const n = new Set(p); n.delete(ev.attackerId); return n; }), 380);
        const mag = Math.min(14, 5 + ev.damage);
        shakeControls.start({
          x: [0, -mag, mag, -mag * 0.6, mag * 0.6, -mag * 0.25, 0],
          transition: { duration: 0.45, ease: "easeOut" },
        });
        pushLog({
          pid: ev.attackerPid, icon: "🩸",
          text: `Leader struck for ${ev.damage} (${ev.leaderHpLeft} left)`,
          tone: "attack",
        });
        if (ev.damage >= 5) {
          setHitStop(true);
          setTimeout(() => setHitStop(false), 130);
        }
      }

      if (ev.type === "TURN_START") {
        const key = ++dmgKeyRef.current;
        setTurnBanner({ key, pid: ev.pid });
        setTimeout(() => setTurnBanner(prev => prev?.key === key ? null : prev), 1200);
      }

      if (ev.type === "CARD_PLAYED") {
        setFreshIds(p => new Set([...p, ev.instanceId]));
        setTimeout(() => setFreshIds(p => { const n = new Set(p); n.delete(ev.instanceId); return n; }), 600);
      }
    }
  }, [pushLog, shakeControls]);

  const dispatch = useCallback((intent: BattleIntent) => {
    // Online the server runs the rules, so just post the intent and wait
    if (online) return online.send(intent);

    // Spell splash needs the name before the engine consumes the spell
    if (intent.type === "CAST_SPELL") {
      const sp = engine.getState().players[intent.pid].spells.find(s => s.id === intent.spellId);
      if (sp) {
        const key = ++dmgKeyRef.current;
        setSpellFlash({ key, name: sp.name });
        setTimeout(() => setSpellFlash(prev => prev?.key === key ? null : prev), 950);
      }
    }

    const before = engine.getState();
    const result = engine.apply(intent);
    setBattleState(result.state);

    // Turn passed, so hand the device over before showing the next player's cards
    if (!result.state.winner && result.state.activePlayer !== before.activePlayer) {
      setHandoffTo(result.state.activePlayer);
    }
    playEvents(result.events, before);
  }, [engine, online, playEvents, setBattleState]);

  // Online, events arrive with each server update rather than from a local apply.
  const lastEventsRef = useRef<BattleEvent[] | null>(null);
  const prevOnlineStateRef = useRef<BattleState | null>(null);
  useEffect(() => {
    if (!online) return;
    if (online.events === lastEventsRef.current) return;
    const before = prevOnlineStateRef.current ?? online.state;
    lastEventsRef.current = online.events;
    prevOnlineStateRef.current = online.state;
    if (online.events.length) playEvents(online.events, before);
  }, [online, playEvents]);

  // Sync engine with post-mulligan React state when battle starts, then
  // advance past the DRAW phase so the first player draws their opening card.
  // doReplace() bypasses the engine, so we push the mulligan result in first.
  useEffect(() => {
    if (mulliganStep === "BATTLE") {
      setViewer(battleState.activePlayer);
      engine.setState(battleState);
      if (battleState.phase === "DRAW") {
        dispatch({ type: "END_TURN", pid: battleState.activePlayer });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mulliganStep]);

  const handleEndTurn = () => {
    if (battleState.activePlayer !== viewer) return;
    dispatch({ type: "END_TURN", pid: viewer });
  };

  // ── Turn timer: 60s per turn, auto-ends the turn at 0 ─────────────────────
  const TURN_SECONDS = 60;
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_SECONDS);
  // A match can end without the engine ever emitting GAME_OVER, for instance
  // when someone surrenders or never comes back. A winner on the state is
  // enough on its own.
  useEffect(() => {
    if (battleState.winner && !gameOverShown) setGameOverShown(true);
  }, [battleState.winner, gameOverShown]);

  const [timerPaused, setTimerPaused] = useState(false); // dev toggle
  useEffect(() => {
    if (mulliganStep !== "BATTLE" || battleState.winner || gameOverShown) return;
    setTurnTimeLeft(TURN_SECONDS);
  }, [battleState.activePlayer, battleState.turn, mulliganStep, battleState.winner, gameOverShown]);

  useEffect(() => {
    if (mulliganStep !== "BATTLE" || battleState.winner || gameOverShown || timerPaused) return;
    const iv = setInterval(() => setTurnTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [mulliganStep, battleState.winner, gameOverShown, timerPaused]);

  useEffect(() => {
    if (turnTimeLeft > 0 || timerPaused) return;
    if (mulliganStep !== "BATTLE" || battleState.winner || gameOverShown) return;
    dispatch({ type: "END_TURN", pid: battleState.activePlayer });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnTimeLeft]);

  const handlePlayCard = (instanceId: string) => {
    if (battleState.activePlayer !== viewer) return;
    const pid = viewer;
    const slot = battleState.players[pid].board.findIndex(s => s === null);
    if (slot === -1) return;
    dispatch({ type: "PLAY_CARD", pid, instanceId, slot });
  };

  const handleSelectAttacker = (instanceId: string, ev?: React.MouseEvent) => {
    if (battleState.activePlayer !== viewer) return;
    const pid = viewer;
    if (battleState.pendingAttackerId === instanceId) {
      dispatch({ type: "CANCEL_ATTACK", pid });
      setAttackLineStart(null);
    } else {
      dispatch({ type: "SELECT_ATTACKER", pid, instanceId });
      if (ev) {
        const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
        setAttackLineStart({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
    }
  };

  // Track mouse for attack line
  useEffect(() => {
    if (!battleState.pendingAttackerId) { setAttackLineStart(null); return; }
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [battleState.pendingAttackerId]);

  const handleTargetCard   = (instanceId: string) => {
    if (battleState.activePlayer !== viewer) return;
    const pid = viewer;
    if (!battleState.pendingAttackerId) return;
    dispatch({ type: "ATTACK_CARD", pid, targetInstanceId: instanceId });
  };

  const handleDomainTarget = (targetInstanceId: string) => {
    if (battleState.activePlayer !== viewer) return;
    const pid = viewer;
    dispatch({ type: "DOMAIN_TARGET", pid, targetInstanceId });
  };

  const handleTargetLeader = () => {
    if (battleState.activePlayer !== viewer) return;
    const pid = viewer;
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
    if (battleState.activePlayer !== viewer) return;
    const pid = viewer;
    const eff = spell.effect;
    if (eff.kind === "TURN_BACK_SHEEP") {
      setTurnBackTargeting(prev => !prev);
      return;
    }
    if (eff.kind === "BUFF_ONE_HP" || eff.kind === "BUFF_ONE_ATK" || eff.kind === "BUFF_ONE_BOTH") {
      // Needs own-board target
      dispatch({ type: "CANCEL_ATTACK", pid });
      setBuffOneTargeting(prev => prev === spell.id ? null : spell.id);
      return;
    }
    if (eff.kind === "DAMAGE_TARGET" || eff.kind === "STUN_ONE" || eff.kind === "PURPLE" || eff.kind === "DESTROY_ONE" || eff.kind === "COPY_BOARD_CARD" || eff.kind === "DAMAGE_TARGET_SELF" || eff.kind === "SHEEPIFY_ONE" || eff.kind === "DAMAGE_AND_STUN" || eff.kind === "BEASTIFY_ONE") {
      // Needs a target — enter spell targeting mode (deselect any attacker)
      dispatch({ type: "CANCEL_ATTACK", pid });
      setPendingSpellId(prev => prev === spell.id ? null : spell.id);
    } else {
      // No target needed — cast immediately
      dispatch({ type: "CAST_SPELL", pid, spellId: spell.id });
    }
  };

  const handleSpellTargetCard = (instanceId: string) => {
    const pid = viewer;
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
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
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
                  {def && (
                    <div style={{ position: "relative" }}>
                      <CharacterCard defId={card.defId} def={def} size="md" />
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "linear-gradient(transparent, rgba(0,0,0,0.92) 30%)",
                        borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
                        padding: "18px 6px 6px",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#e8e8e8", letterSpacing: 0.3, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", paddingLeft: 4, paddingRight: 4 }}>
                          {def.name}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-around", width: "100%", padding: "1px 6px" }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#ff8855" }}>⚔{card.atk}</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#44ff88" }}>♥{card.currentHp}</span>
                        </div>
                      </div>
                    </div>
                  )}

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
            <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
              {/* Energy + Domain panel */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 160 }}>
                <div style={{ fontSize: 13, color: "#4aeecc", fontWeight: 900, letterSpacing: 1 }}>
                  ⚡ ENERGY 2/2
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={i < 2 ? { boxShadow: ["0 0 4px #4aeecc66", "0 0 10px #4aeecc", "0 0 4px #4aeecc66"] } : {}}
                      transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.07 }}
                      style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: i < 2 ? "linear-gradient(135deg, #2af 0%, #4aeecc 100%)" : i < 10 ? "#07070e" : "#07070e",
                        border: `1px solid ${i < 2 ? "#4aeecc" : "#111116"}`,
                        opacity: i < 10 ? (i < 2 ? 1 : 0.35) : 0.35,
                      }}
                    />
                  ))}
                </div>
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#2a2a3a", letterSpacing: 1, fontWeight: 700 }}>DOMAIN</span>
                    <span style={{ fontSize: 11, color: "#2a2a3a" }}>0%</span>
                  </div>
                  <div style={{ height: 12, background: "#090912", borderRadius: 6, border: "1px solid #1a1a2e" }} />
                </div>
              </div>
              {/* Leader card */}
              <div style={{ position: "relative" }}>
                {cardDb[mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId] && (
                  <CharacterCard
                    defId={mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId}
                    def={cardDb[mPid === "P1" ? p1Draft.leaderId : p2Draft.leaderId]}
                    size="lg" noHover
                  />
                )}
                <div style={{
                  position: "absolute", top: 6, left: 6,
                  fontSize: 9, fontWeight: 900, letterSpacing: 1,
                  background: "rgba(255,200,0,0.88)", color: "#000",
                  padding: "2px 8px", borderRadius: 4,
                }}>LEADER</div>
                <div style={{
                  position: "absolute", bottom: 28, left: 0, right: 0,
                  display: "flex", justifyContent: "space-around", padding: "3px 6px",
                  background: "rgba(0,0,0,0.82)",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#ff8855" }}>⚔2</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#44ff88" }}>♥30/30</span>
                </div>
              </div>

              {/* FIRST / SECOND indicator — right of leader card */}
              {(() => {
                const goSecondSpell = mPlayer.spells.find(s => s.synergyId === "go-second");
                return (
                  <motion.div
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                    style={{
                      width: 160, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 14,
                      padding: "18px 16px", borderRadius: 14,
                      background: goesFirst ? "rgba(74,238,204,0.07)" : "rgba(204,68,255,0.07)",
                      border: `1.5px solid ${goesFirst ? "#4aeecc44" : "#cc44ff44"}`,
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: 9, letterSpacing: 3, fontWeight: 700, marginBottom: 8,
                        color: goesFirst ? "#4aeecc88" : "#cc44ff88",
                      }}>YOU GO</div>
                      <div style={{
                        fontSize: 28, fontWeight: 900, letterSpacing: 3,
                        color: goesFirst ? "#4aeecc" : "#cc44ff",
                        textShadow: `0 0 20px ${goesFirst ? "#4aeecc66" : "#cc44ff66"}`,
                      }}>
                        {goesFirst ? "FIRST" : "SECOND"}
                      </div>
                    </div>

                    {goesFirst ? (
                      <div style={{ fontSize: 10, color: "#4aeecc66", textAlign: "center", lineHeight: 1.4 }}>
                        You take the first turn
                      </div>
                    ) : goSecondSpell ? (
                      <>
                        <div
                          onMouseMove={ev => setGoSecondSpellHover({ x: ev.clientX, y: ev.clientY })}
                          onMouseLeave={() => setGoSecondSpellHover(null)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "5px 12px", borderRadius: 8, cursor: "default",
                            background: "rgba(204,68,255,0.15)",
                            border: "1px solid #cc44ff66",
                            fontSize: 11, fontWeight: 700, color: "#cc44ff",
                            letterSpacing: 0.5,
                          }}
                        >✦ {goSecondSpell.name}</div>
                        {goSecondSpellHover && (
                          <HoverTooltip x={goSecondSpellHover.x} y={goSecondSpellHover.y}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: "#cc44ff", letterSpacing: 2, marginBottom: 6 }}>✦ BONUS SPELL</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{goSecondSpell.name}</div>
                            <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{goSecondSpell.description}</div>
                          </HoverTooltip>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: "#cc44ff66", textAlign: "center", lineHeight: 1.4 }}>
                        + bonus spell on start
                      </div>
                    )}
                  </motion.div>
                );
              })()}
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

  const pid    = viewer;
  const oppId: PlayerId = pid === "P1" ? "P2" : "P1";
  const player: BattlePlayer = battleState.players[pid];
  const opp:   BattlePlayer  = battleState.players[oppId];
  // Nothing on the board is clickable while the other player is acting.
  const isMyTurn = battleState.activePlayer === viewer;
  const name    = pid === "P1" ? p1Name : p2Name;
  const icon    = pid === "P1" ? p1Icon : p2Icon;
  const oppName = oppId === "P1" ? p1Name : p2Name;
  const oppIcon = oppId === "P1" ? p1Icon : p2Icon;
  // enemyTargeting highlights opponent cards; own-card buff targeting does NOT
  // Perk targeting stages: mahito = enemy→friendly; inumaki = 1 enemy; nobara = 2 enemies; gakuganji = 1 friendly
  const perkEnemyStage = pendingPerk !== null && (
    (pendingPerk.defId === "mahito" && !pendingPerk.enemyTargetId) ||
    pendingPerk.defId === "inumaki" ||
    pendingPerk.defId === "nobara" ||
    pendingPerk.defId === "higuruma" ||
    pendingPerk.defId === "hanami"   // Hanami can stun either side
  );
  const perkFriendStage = pendingPerk !== null && (
    (pendingPerk.defId === "mahito" && !!pendingPerk.enemyTargetId) ||
    pendingPerk.defId === "gakuganji" ||
    pendingPerk.defId === "hanami"
  );
  const enemyTargeting = battleState.pendingAttackerId !== null || pendingSpellId !== null || battleState.pendingDomainAction !== null || perkEnemyStage;

  // Leader is only a valid target in specific modes
  const oppBoardCards = opp.board.filter(c => c !== null);
  const pendingSpell  = pendingSpellId ? player.spells.find(s => s.id === pendingSpellId) ?? null : null;
  // Inside Malevolent Shrine nothing is protected — shields stop mattering
  const oppHasShield = !opp.sukunaBoardMode && oppBoardCards.some(c => c.hasTaunt);
  const pendingAttackerCard = battleState.pendingAttackerId
    ? player.board.find(c => c?.instanceId === battleState.pendingAttackerId) ?? (player.leader.instanceId === battleState.pendingAttackerId ? player.leader : null)
    : null;
  const leaderTargetable =
    // Attack: when no enemy shields remain, or Toji berserk, or the attacker's Shield Breaker perk is active.
    // A sentenced attacker can never reach the leader.
    (battleState.pendingAttackerId !== null && !pendingAttackerCard?.sentencedWith &&
      (!oppHasShield || player.tojiBerserk || pendingAttackerCard?.ignoreShields === true)) ||
    // Damage spells hit the leader only when the enemy board is clear; stun spells can always target
    (pendingSpell !== null && (
      pendingSpell.effect.kind === "STUN_ONE" ||
      ((pendingSpell.effect.kind === "DAMAGE_TARGET" || pendingSpell.effect.kind === "DAMAGE_TARGET_SELF") && oppBoardCards.length === 0)
    )) ||
    // Domain action targets enemy (sheepify cannot target the leader)
    (battleState.pendingDomainAction !== null && battleState.pendingDomainAction.kind !== "SHEEPIFY_ENEMY_CARDS");

  const handleActivatePerk = (card: BattleCard) => {
    if (battleState.phase !== "MAIN") return;
    if (battleState.activePlayer !== viewer) return;
    if (pendingPerk?.instanceId === card.instanceId) { setPendingPerk(null); return; } // toggle off
    // Perks that need target selection before dispatching
    if (["mahito", "inumaki", "gakuganji", "nobara", "hanami", "higuruma"].includes(card.defId)) {
      setPendingPerk({ instanceId: card.instanceId, defId: card.defId });
      return;
    }
    dispatch({ type: "ACTIVATE_PERK", pid, instanceId: card.instanceId });
  };

  const handleOwnCardClick = (instanceId: string, ev?: React.MouseEvent) => {
    if (battleState.activePlayer !== viewer) return;
    // Mahito perk stage 2: pick the same-cost friendly card
    if (pendingPerk?.defId === "mahito" && pendingPerk.enemyTargetId) {
      dispatch({
        type: "ACTIVATE_PERK", pid,
        instanceId: pendingPerk.instanceId,
        targetInstanceId: pendingPerk.enemyTargetId,
        friendlyTargetInstanceId: instanceId,
      });
      setPendingPerk(null);
      return;
    }
    // Hanami perk: stun a friendly card
    if (pendingPerk?.defId === "hanami") {
      dispatch({ type: "ACTIVATE_PERK", pid, instanceId: pendingPerk.instanceId, targetInstanceId: instanceId });
      setPendingPerk(null);
      return;
    }
    // Gakuganji perk: pick the friendly card to buff
    if (pendingPerk?.defId === "gakuganji") {
      dispatch({
        type: "ACTIVATE_PERK", pid,
        instanceId: pendingPerk.instanceId,
        friendlyTargetInstanceId: instanceId,
      });
      setPendingPerk(null);
      return;
    }
    if (pendingShieldGrant) {
      dispatch({ type: "GRANT_BOARD_SHIELD", pid, targetInstanceId: instanceId });
      setPendingShieldGrant(false);
      return;
    }
    if (pendingBlockGrant) {
      dispatch({ type: "GRANT_BLOCK", pid, targetInstanceId: instanceId });
      setPendingBlockGrant(false);
      return;
    }
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
    // COPY_BOARD_CARD / BEASTIFY_ONE can target own board cards too
    if (pendingSpellId && (pendingSpell?.effect.kind === "COPY_BOARD_CARD" || pendingSpell?.effect.kind === "BEASTIFY_ONE")) {
      dispatch({ type: "CAST_SPELL", pid: battleState.activePlayer, spellId: pendingSpellId, targetInstanceId: instanceId });
      setPendingSpellId(null);
      return;
    }
    // Damage spells can now target own cards
    if (pendingSpellId && (pendingSpell?.effect.kind === "DAMAGE_TARGET" || pendingSpell?.effect.kind === "DAMAGE_TARGET_SELF")) {
      dispatch({ type: "CAST_SPELL", pid: battleState.activePlayer, spellId: pendingSpellId, targetInstanceId: instanceId });
      setPendingSpellId(null);
      return;
    }
    handleSelectAttacker(instanceId, ev);
  };

  const winnerName = battleState.winner ? (battleState.winner === "P1" ? p1Name : p2Name) : "";
  const winnerIcon = battleState.winner ? (battleState.winner === "P1" ? p1Icon : p2Icon) : "";

  return (
    <ErrorBoundary>
    {/* Static outer shell clips the shake so no scrollbars appear */}
    <div style={{
      minHeight: "100vh", maxHeight: "100vh",
      background: "linear-gradient(180deg, #020209 0%, #04021a 50%, #020209 100%)",
      overflow: "hidden", position: "relative",
    }}>
    <motion.div animate={shakeControls} style={{
      minHeight: "100vh", maxHeight: "100vh",
      display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: "hidden", position: "relative",
    }}>
      {/* Rolling readout of recent events */}
      <BattleLog entries={logEntries} />

      {/* Layered 2.5D shrine arena — parallax backdrop with interactive props */}
      <BattleArena
        domainLeaderId={
          player.domainActive ? player.leader.defId
          : opp.domainActive ? opp.leader.defId
          : null
        }
      />

      {/* Opponent's hand as face down cards. You only ever see how many they hold. */}
      <div style={{
        position: "relative", zIndex: 2, flexShrink: 0,
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        height: 34, pointerEvents: "none",
      }}>
        {opp.hand.map((card, i) => {
          const spread = Math.min(opp.hand.length, 10);
          const offset = (i - (spread - 1) / 2) * 26;
          return (
            <motion.div
              key={card.instanceId}
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: -16, opacity: 1, rotate: (i - (spread - 1) / 2) * 2.2 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              style={{
                position: "absolute", left: `calc(50% + ${offset}px)`,
                width: 30, height: 42, marginLeft: -15,
                borderRadius: 4,
                background: "linear-gradient(160deg, #1a1a3a, #0a0a1e)",
                border: "1px solid #2e2e5a",
                boxShadow: "0 3px 10px rgba(0,0,0,0.7)",
                transformOrigin: "top center",
              }}
            />
          );
        })}
        {opp.hand.length > 0 && (
          <div style={{
            position: "absolute", right: 22, top: 6,
            fontSize: 9, color: "#556", letterSpacing: 2,
          }}>{opp.hand.length} IN HAND</div>
        )}
      </div>

      {/* ── OPPONENT LEADER (top, centered) ──────────────────────────────── */}
      <div style={{
        background: "rgba(0,0,0,0.2)",
        position: "relative", zIndex: 1, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "visible",
      }}>
        <div style={{ transform: "scale(1.08)", transformOrigin: "center center" }}>
          <CenteredLeader
            leader={opp.leader} cardDb={cardDb}
            playerName={oppName} playerIcon={oppIcon}
            targetable={leaderTargetable}
            onSelect={leaderTargetable ? handleTargetLeader : undefined}
            isTop
            domainBadgeDefId={opp.leader.defId}
            isVacant={opp.sukunaBoardMode || opp.mahoragaBoardMode || opp.takabaBoardMode}
            isHit={leaderHitPid === oppId}
          />
        </div>
      </div>

      {/* ── OPPONENT BOARD ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", zIndex: 20,
        background: "linear-gradient(180deg, rgba(120,30,40,0.09), rgba(60,10,20,0.04))",
        border: "1px solid rgba(255,90,110,0.09)",
        borderRadius: 14, margin: "4px 14px 2px",
        boxShadow: "inset 0 0 40px rgba(160,40,60,0.07)",
        minHeight: 130,
      }}>
        <motion.div
          animate={{ opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, #6600aa22, transparent 70%)" }}
        />
        <BoardParticles />
        <div style={{ position: "absolute", top: 5, left: 16, fontSize: 8, letterSpacing: 4, color: "#7a4a55", fontWeight: 800, zIndex: 1, display: "flex", gap: 8, alignItems: "center" }}>
          ⚔ OPPONENT
          {opp.turnFrozen > 0 && (
            <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 0.8, repeat: Infinity }}
              style={{ fontSize: 7, letterSpacing: 2, color: "#cc44ff", background: "rgba(204,68,255,0.12)", border: "1px solid #cc44ff44", borderRadius: 4, padding: "1px 5px" }}>
              🌌 VOID IMMOBILIZED {opp.turnFrozen}T
            </motion.div>
          )}
          {opp.cardPlayFrozen > 0 && opp.turnFrozen <= 0 && (
            <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 0.8, repeat: Infinity }}
              style={{ fontSize: 7, letterSpacing: 2, color: "#4488ff", background: "rgba(68,136,255,0.12)", border: "1px solid #4488ff44", borderRadius: 4, padding: "1px 5px" }}>
              ❄ FROZEN {opp.cardPlayFrozen}T
            </motion.div>
          )}
        </div>
        <BoardRow
          board={opp.board} cardDb={cardDb} cardScale={1.3}
          pendingId={null} targeting={enemyTargeting} myBoard={false}
          pinnedIds={player.resonance ? new Set([player.resonance.a, player.resonance.b]) : undefined}
          isTargetable={(c) => {
            if (battleState.pendingAttackerId === null) return true; // spells / domain actions
            // Higuruma's Sentence overrides everything — only the bound counterpart is legal
            if (pendingAttackerCard?.sentencedWith) return pendingAttackerCard.sentencedWith === c.instanceId;
            // Attacks must otherwise respect shields
            return player.tojiBerserk || !oppHasShield || c.hasTaunt;
          }}
          lungeIds={lungeIds}
          onTargetCard={(id) => {
            // Mahito perk stage 1: pick the enemy card
            if (perkEnemyStage && pendingPerk) {
              if (pendingPerk.defId === "inumaki" || pendingPerk.defId === "hanami" || pendingPerk.defId === "higuruma") {
                dispatch({ type: "ACTIVATE_PERK", pid, instanceId: pendingPerk.instanceId, targetInstanceId: id });
                setPendingPerk(null);
              } else if (pendingPerk.defId === "nobara") {
                if (!pendingPerk.enemyTargetId) {
                  setPendingPerk({ ...pendingPerk, enemyTargetId: id });
                } else if (pendingPerk.enemyTargetId !== id) {
                  dispatch({ type: "ACTIVATE_PERK", pid, instanceId: pendingPerk.instanceId, targetInstanceId: pendingPerk.enemyTargetId, secondTargetInstanceId: id });
                  setPendingPerk(null);
                }
              } else {
                // Mahito stage 1
                setPendingPerk({ ...pendingPerk, enemyTargetId: id });
              }
              return;
            }
            if (pendingSpellId) handleSpellTargetCard(id);
            else if (battleState.pendingDomainAction) handleDomainTarget(id);
            else handleTargetCard(id);
          }}
          hitIds={hitIds} freshIds={freshIds} floatingDmgMap={floatingDmgMap}
        />
      </div>

      {/* ── CENTER INFO BAR ───────────────────────────────────────────────── */}
      <div style={{
        padding: "6px 24px", zIndex: 2,
        background: "rgba(0,0,0,0.7)",
        display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
        borderTop: "1px solid #111128",
        flexShrink: 0,
      }}>
        {/* Left: turn counter only */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 8, color: "#2a2a3a", letterSpacing: 3 }}>TURN {battleState.turn}</div>
        </div>

        {/* Center: turn indicator + END TURN button side by side */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", position: "relative" }}>
          {!timerPaused && (
            <RopeTimer secondsLeft={turnTimeLeft} />
          )}
          <motion.div
            animate={isMyTurn ? {} : { opacity: [0.55, 1, 0.55] }}
            transition={isMyTurn ? {} : { duration: 1.8, repeat: Infinity }}
            style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 2,
              color: isMyTurn ? (pid === "P1" ? COLOR.p1 : COLOR.p2) : "#7a7a90",
              background: isMyTurn
                ? (pid === "P1" ? "rgba(74,158,255,0.07)" : "rgba(255,102,102,0.07)")
                : "rgba(255,255,255,0.03)",
              padding: "3px 12px", borderRadius: 6,
              border: `1px solid ${isMyTurn ? (pid === "P1" ? "#4a9eff33" : "#ff666633") : "#2a2a3a"}`,
            }}
          >{isMyTurn ? "YOUR TURN" : `WAITING FOR ${oppName.toUpperCase()}`}</motion.div>
          {/* End turn — Hearthstone's button tells you whether you still have moves.
              Amber and pulsing while something is left to do, calm green once you're spent. */}
          {(() => {
            const boardFull = player.board.every(s => s !== null);
            const canPlayCard = !boardFull && player.cardPlayFrozen === 0 &&
              player.hand.some(c => player.energy >= Math.max(0, c.cost - player.costReduction));
            const canAttack = [player.leader, ...(player.board.filter(Boolean) as BattleCard[])]
              .some(c => c.canAttack && !c.exhausted && c.stunTurns === 0);
            const idle = canPlayCard || canAttack;
            const accent = idle ? "#ffbb33" : COLOR.hpGood;
            return (
              <motion.button
                onClick={handleEndTurn}
                whileHover={{ scale: 1.05, boxShadow: `0 0 18px ${accent}66` }}
                whileTap={{ scale: 0.95 }}
                animate={idle
                  ? { boxShadow: [`0 0 0 ${accent}00`, `0 0 20px ${accent}55`, `0 0 0 ${accent}00`] }
                  : { boxShadow: `0 0 0 ${accent}00` }}
                transition={idle ? { duration: 1.7, repeat: Infinity } : { duration: 0.3 }}
                style={{
                  padding: "7px 28px",
                  background: idle
                    ? "linear-gradient(135deg, #2e2004, #3d2a06)"
                    : "linear-gradient(135deg, #0a2a12, #0d3a16)",
                  border: `1px solid ${accent}55`,
                  borderRadius: 8, color: accent, fontSize: 11, fontWeight: 900,
                  letterSpacing: 2, cursor: "pointer", fontFamily: "inherit",
                  minWidth: 148,
                }}
                title={idle ? "You still have moves available" : "Nothing left to do this turn"}
              >{idle ? "END TURN" : "END TURN →"}</motion.button>
            );
          })()}

          {/* Turn timer — countdown + draining bar */}
          {(() => {
            const frac = turnTimeLeft / TURN_SECONDS;
            const urgent = turnTimeLeft <= 10 && !timerPaused;
            const tColor = timerPaused ? "#8899aa" : urgent ? "#ff5544" : frac <= 0.5 ? "#ffcc44" : "#4aeecc";
            return (
              <motion.div
                animate={urgent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={urgent ? { duration: 0.5, repeat: Infinity } : {}}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  minWidth: 64,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    fontSize: 19, fontWeight: 900, color: tColor, letterSpacing: 1,
                    textShadow: urgent ? "0 0 12px #ff4433" : `0 0 8px ${tColor}44`,
                    fontVariantNumeric: "tabular-nums", lineHeight: 1,
                  }}>
                    ⏱ {turnTimeLeft}s
                  </div>
                  {/* Dev: pause the turn timer */}
                  <button
                    onClick={() => setTimerPaused(v => !v)}
                    title={timerPaused ? "Resume turn timer (dev)" : "Pause turn timer (dev)"}
                    style={{
                      width: 18, height: 18, borderRadius: 4, lineHeight: 1,
                      background: timerPaused ? "rgba(140,160,190,0.18)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${timerPaused ? "#8899aa77" : "rgba(255,255,255,0.12)"}`,
                      color: timerPaused ? "#aabbcc" : "#556",
                      fontSize: 8, cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: 0,
                    }}
                  >{timerPaused ? "▶" : "❚❚"}</button>
                </div>
                <div style={{
                  width: 150, height: 7, borderRadius: 4,
                  background: "rgba(255,255,255,0.08)", overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
                }}>
                  <div style={{
                    height: "100%", width: `${frac * 100}%`,
                    background: `linear-gradient(90deg, ${tColor}, ${tColor}cc)`,
                    boxShadow: `0 0 8px ${tColor}aa`,
                    transition: "width 1s linear, background 0.4s",
                  }} />
                </div>
              </motion.div>
            );
          })()}

          {/* Online only: concede the match */}
          {isOnline && !battleState.winner && (
            <button
              onClick={() => online?.surrender()}
              title="Give up this match"
              style={{
                padding: "6px 12px", borderRadius: 8,
                background: "rgba(255,80,80,0.07)", border: "1px solid #7a3030",
                color: "#bb6666", fontSize: 9, letterSpacing: 2, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >SURRENDER</button>
          )}
        </div>

        {/* Right: targeting / action badges */}
        <div style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "flex-end" }}>
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
          {pendingShieldGrant && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(68,136,255,0.14)", border: "1px solid #4488ff66",
              color: "#88bbff", letterSpacing: 1, fontWeight: 900,
            }}>🛡 SELECT A CARD OR YOUR LEADER TO SHIELD</div>
          )}
          {pendingBlockGrant && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(255,170,60,0.14)", border: "1px solid #ffaa3366",
              color: "#ffcc77", letterSpacing: 1, fontWeight: 900,
            }}>✋ SELECT A CARD OR YOUR LEADER TO BLOCK</div>
          )}
          {perkEnemyStage && pendingPerk && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(255,190,40,0.14)", border: "1px solid #ffcc4466",
              color: "#ffcc44", letterSpacing: 1, fontWeight: 900,
            }}>
              {pendingPerk.defId === "mahito" ? "🖐 SELECT AN ENEMY CARD TO TRANSFIGURE"
                : pendingPerk.defId === "hanami" ? "🌸 SELECT ANY CARD TO STUN, FRIEND OR FOE"
                : pendingPerk.defId === "higuruma" ? "⚖ SELECT AN ENEMY CARD TO SENTENCE"
                : pendingPerk.defId === "inumaki" ? "🗣 SELECT AN ENEMY CARD TO STUN"
                : pendingPerk.enemyTargetId ? "📌 SELECT THE SECOND ENEMY CARD TO PIN"
                : "📌 SELECT THE FIRST ENEMY CARD TO PIN"}
            </div>
          )}
          {perkFriendStage && pendingPerk && (
            <div style={{
              fontSize: 9, padding: "3px 12px", borderRadius: 6,
              background: "rgba(255,190,40,0.14)", border: "1px solid #ffcc4466",
              color: "#ffcc44", letterSpacing: 1, fontWeight: 900,
            }}>
              {pendingPerk.defId === "gakuganji" ? "🎸 SELECT YOUR CARD TO GIVE +1 ATK" : "🖐 SELECT YOUR CARD OF THE SAME COST"}
            </div>
          )}
        </div>

      </div>

      {/* ── MY BOARD + LEADER PANEL (row: board center, leader right) ───── */}
      <div style={{
        flex: 1.5, display: "flex", flexDirection: "row",
        position: "relative", zIndex: 20, minHeight: 200, overflow: "visible",
        background: "linear-gradient(180deg, rgba(30,90,110,0.07), rgba(15,45,70,0.04))",
        border: "1px solid rgba(80,200,230,0.09)",
        borderRadius: 14, margin: "2px 14px 4px",
        boxShadow: "inset 0 0 40px rgba(40,130,160,0.06)",
      }}>
        <motion.div
          animate={{ opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, #6600aa22, transparent 70%)" }}
        />
        <BoardParticles />
        {/* Spacer matching the right-hand column (orb + leader panel + gutter) so the
            board row centres on screen and lines up with the opponent's row above. */}
        <div style={{ width: RIGHT_COLUMN_WIDTH, flexShrink: 0 }} aria-hidden />
        {/* Board area */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ position: "absolute", top: 5, left: 16, fontSize: 8, letterSpacing: 4, color: "#4a7a80", fontWeight: 800, zIndex: 1 }}>🛡 YOUR BOARD</div>
          <div style={{ transform: "scale(1.2)", transformOrigin: "center center" }}>
            <BoardRow
              board={player.board} cardDb={cardDb} cardScale={1.5}
              pendingId={battleState.pendingAttackerId}
              targeting={pendingSpellId !== null && (pendingSpell?.effect.kind === "DAMAGE_TARGET" || pendingSpell?.effect.kind === "DAMAGE_TARGET_SELF")}
              buffTargeting={buffOneTargeting !== null || perkFriendStage} myBoard
              pinnedIds={opp.resonance ? new Set([opp.resonance.a, opp.resonance.b]) : undefined}
              onActivatePerk={handleActivatePerk}
              onAttackRandom={(card) => dispatch({ type: "ATTACK_RANDOM", pid, instanceId: card.instanceId })}
              perkActiveId={pendingPerk?.instanceId ?? null}
              lungeIds={lungeIds}
              onSelectCard={handleOwnCardClick}
              hitIds={hitIds} freshIds={freshIds} floatingDmgMap={floatingDmgMap}
            />
          </div>
        </div>

        {/* Domain status orb — between board cards and leader panel */}
        <DomainOrb
          meter={player.domainMeter}
          cooldown={player.domainCooldown}
          leaderId={player.leader.defId}
          onActivate={() => { if (isMyTurn) dispatch({ type: "ACTIVATE_DOMAIN", pid }); }}
        />

        {/* Leader panel (right) — domain meter is now built-in on the left of the panel */}
        <div style={{ marginRight: RIGHT_COLUMN_GUTTER }}>
          <LeaderRightPanel
            isHit={leaderHitPid === pid}
            leader={player.leader} cardDb={cardDb}
            playerName={name} playerIcon={icon}
            leaderShields={player.leaderShields}
            isVacant={player.mahoragaBoardMode || player.sukunaBoardMode || player.takabaBoardMode}
            selected={!player.mahoragaBoardMode && !player.sukunaBoardMode && !player.takabaBoardMode && battleState.pendingAttackerId === player.leader.instanceId}
            domainMeter={player.domainMeter}
            domainCooldown={player.domainCooldown}
            onDomainActivate={() => { if (isMyTurn) dispatch({ type: "ACTIVATE_DOMAIN", pid }); }}
            onSelect={(ev) => {
              // Shields stack on the leader; a Block nullifies the next damage instance
              if (pendingShieldGrant) {
                dispatch({ type: "GRANT_BOARD_SHIELD", pid, targetInstanceId: player.leader.instanceId });
                setPendingShieldGrant(false);
                return;
              }
              if (pendingBlockGrant) {
                dispatch({ type: "GRANT_BLOCK", pid, targetInstanceId: player.leader.instanceId });
                setPendingBlockGrant(false);
                return;
              }
              if (buffOneTargeting) {
                dispatch({ type: "CAST_SPELL", pid, spellId: buffOneTargeting, targetInstanceId: player.leader.instanceId });
                setBuffOneTargeting(null);
                return;
              }
              if (pendingSpellId && (pendingSpell?.effect.kind === "DAMAGE_TARGET" || pendingSpell?.effect.kind === "DAMAGE_TARGET_SELF")) {
                dispatch({ type: "CAST_SPELL", pid, spellId: pendingSpellId, targetInstanceId: player.leader.instanceId });
                setPendingSpellId(null);
                return;
              }
              handleSelectAttacker(player.leader.instanceId, ev);
            }}
          />
        </div>
      </div>

      {/* ── HAND + SPELLS + DECK (bottom row) ───────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: "flex", flexDirection: "row",
        background: "rgba(0,0,0,0.35)", borderTop: "1px solid #0c0c1e",
        position: "relative", zIndex: 30, height: 185, overflow: "visible",
      }}>
        {/* Spells panel — absolutely positioned, fixed height matching hand row */}
        <div style={{
          position: "absolute", left: 0, bottom: 0, zIndex: 40,
          display: "flex", flexDirection: "row",
          background: "rgba(0,0,0,0.35)", borderTop: "1px solid #1a1a30",
        }}>
        {/* Spells grid */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          padding: "10px 12px", borderRight: "1px solid #1a1a30", gap: 8,
          position: "relative",
        }}>
          {/* Active synergies waiting to be drawn, stacked above this panel */}
          {player.activeSynergies.length > 0 && (() => {
            const obtainedSpellNames = new Set([
              ...player.spells.map(sp => sp.name),
              ...player.spellQueue.map(sp => sp.name),
            ]);
            const visibleSynergies = player.activeSynergies.filter(id => {
              const rule = BATTLE_SYNERGY_RULES.find(r => r.id === id);
              return rule && !obtainedSpellNames.has(rule.spellName);
            });
            return visibleSynergies.length > 0 ? (
              <div style={{
                position: "absolute", bottom: "100%", left: 10, marginBottom: 6,
                display: "flex", flexDirection: "column", gap: 4, zIndex: 5,
              }}>
                {visibleSynergies.map(id => <SynergyTag key={id} id={id} />)}
              </div>
            ) : null;
          })()}
          {/* Shield and Block charges */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {Array.from({ length: 3 }).map((_, i) => {
              const available = i < player.shieldCharges;
              const isActive = pendingShieldGrant && available;
              return (
                <div key={i} style={{ position: "relative" }}
                  onMouseEnter={e => {
                    const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".shield-tip");
                    if (tip) tip.style.display = "block";
                  }}
                  onMouseLeave={e => {
                    const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".shield-tip");
                    if (tip) tip.style.display = "none";
                  }}
                >
                  <motion.button
                    onClick={() => { if (available && battleState.phase === "MAIN") setPendingShieldGrant(v => !v); }}
                    whileHover={available && battleState.phase === "MAIN" ? { scale: 1.15 } : {}}
                    whileTap={available && battleState.phase === "MAIN" ? { scale: 0.9 } : {}}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: available
                        ? isActive
                          ? "linear-gradient(135deg, #4488ff, #0044cc)"
                          : "linear-gradient(135deg, #1a3a6e, #0a1a4a)"
                        : "rgba(255,255,255,0.03)",
                      border: available
                        ? `2px solid ${isActive ? "#88bbff" : "rgba(100,180,255,0.6)"}`
                        : "2px solid #1a1a2a",
                      cursor: available && battleState.phase === "MAIN" ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14,
                      opacity: available ? 1 : 0.2,
                      boxShadow: isActive ? "0 0 14px #4488ffaa" : available ? "0 0 6px rgba(80,160,255,0.3)" : "none",
                      padding: 0,
                    }}
                  >
                    🛡
                  </motion.button>
                  <div className="shield-tip" style={{
                    display: "none", position: "absolute", bottom: 34, left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(4,4,14,0.97)", border: "1px solid #2a3a6a",
                    borderRadius: 8, padding: "7px 10px",
                    width: 180, zIndex: 999,
                    fontSize: 9, color: "#aac", lineHeight: 1.5, pointerEvents: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
                  }}>
                    Give Shield to a character. (Shield disallows targeting of other non-Shield Cards.)
                  </div>
                </div>
              );
            })}
            <div style={{ width: 1, height: 20, background: "#22223a", margin: "0 3px" }} />
            {Array.from({ length: 3 }).map((_, i) => {
              const available = i < player.blockCharges;
              const isActive = pendingBlockGrant && available;
              return (
                <div key={`blk-${i}`} style={{ position: "relative" }}
                  onMouseEnter={e => {
                    const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".block-tip");
                    if (tip) tip.style.display = "block";
                  }}
                  onMouseLeave={e => {
                    const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".block-tip");
                    if (tip) tip.style.display = "none";
                  }}
                >
                  <motion.button
                    onClick={() => { if (available && battleState.phase === "MAIN") { setPendingShieldGrant(false); setPendingBlockGrant(v => !v); } }}
                    whileHover={available && battleState.phase === "MAIN" ? { scale: 1.15 } : {}}
                    whileTap={available && battleState.phase === "MAIN" ? { scale: 0.9 } : {}}
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: available
                        ? isActive
                          ? "linear-gradient(135deg, #ffaa33, #cc6600)"
                          : "linear-gradient(135deg, #4a3410, #2a1c06)"
                        : "rgba(255,255,255,0.03)",
                      border: available
                        ? `2px solid ${isActive ? "#ffcc77" : "rgba(255,180,80,0.6)"}`
                        : "2px solid #1a1a2a",
                      cursor: available && battleState.phase === "MAIN" ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13,
                      opacity: available ? 1 : 0.2,
                      boxShadow: isActive ? "0 0 14px #ffaa33aa" : available ? "0 0 6px rgba(255,170,60,0.3)" : "none",
                      padding: 0,
                    }}
                  >
                    ✋
                  </motion.button>
                  <div className="block-tip" style={{
                    display: "none", position: "absolute", bottom: 34, left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(4,4,14,0.97)", border: "1px solid #6a4a2a",
                    borderRadius: 8, padding: "7px 10px",
                    width: 190, zIndex: 999,
                    fontSize: 9, color: "#cba", lineHeight: 1.5, pointerEvents: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
                  }}>
                    Block the next damage instance for one card or your leader. One Block per card at a time, but it can be reapplied once it breaks.
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 9, color: "#556", letterSpacing: 3, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            SPELLS
            {player.spellQueue.length > 0 && (
              <span style={{
                color: "#ee66ff", fontWeight: 900, fontSize: 11,
                background: "rgba(180,50,255,0.15)", border: "1px solid #cc44ff55",
                borderRadius: 5, padding: "1px 8px", letterSpacing: 1,
              }}>+{player.spellQueue.length} QUEUED</span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => {
              const spell = player.spells[i];
              if (spell) {
                return (
                  <SpellCardView
                    key={spell.id}
                    spell={spell}
                    active={pendingSpellId === spell.id || buffOneTargeting === spell.id}
                    onClick={() => handleSpellClick(spell)}
                  />
                );
              }
              return (
                <div key={`empty-${i}`} style={{
                  borderRadius: 10, padding: "14px 10px",
                  background: "rgba(255,255,255,0.01)",
                  border: "1px dashed #1a1a2a",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 6, minHeight: 110, minWidth: 110,
                }}>
                  <div style={{ fontSize: 22, color: "#1a1a2a" }}>✦</div>
                  <div style={{ fontSize: 8, color: "#1a1a2a", letterSpacing: 1 }}>EMPTY</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GET SPELL button */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 10px", borderRight: "1px solid #1a1a30", gap: 6, minWidth: 80,
        }}>
          {(() => {
            const canDraw = player.spellPool.length > 0;
            // Gojo's domain lifts the once-per-turn limit this turn
            const disabled = !canDraw || (player.synergyDrawUsed && !player.unlimitedSpellDraw) || player.energy < 1;
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
                }}>1⚡</span>
                {player.synergyDrawUsed && (
                  <span style={{ fontSize: 6, color: "#556", letterSpacing: 0.5 }}>USED</span>
                )}
                {!player.synergyDrawUsed && (
                  <span style={{ fontSize: 6, color: canDraw ? "#666" : "#334", letterSpacing: 0.5 }}>
                    {player.spellPool.length} LEFT
                  </span>
                )}
              </motion.button>
            );
          })()}
        </div>

        </div>{/* close absolute spell+getspell wrapper */}

        {/* Spacer matching the absolute spell panel width so energy/hand/deck don't overlap */}
        <div style={{ flexShrink: 0, width: 370 }} />

        {/* Energy column — compact vertical strip between GET SPELL and hand cards */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "10px 12px", borderRight: "1px solid #1a1a30",
          gap: 7, minWidth: 70,
        }}>
          <span style={{ fontSize: 14, color: "#4aeecc", fontWeight: 900, letterSpacing: 1, textAlign: "center" }}>
            ⚡ {player.energy}/{player.maxEnergy}
          </span>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const unlocked = i < player.maxEnergy;
              const filled   = i < player.energy;
              return (
                <motion.div key={i}
                  animate={filled ? { boxShadow: ["0 0 6px #4aeecc88", "0 0 16px #4aeecc", "0 0 6px #4aeecc88"] } : {}}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.06 }}
                  style={{
                    width: 20, height: 20, borderRadius: 5,
                    background: filled ? "linear-gradient(135deg, #1adfff 0%, #4aeecc 100%)" : unlocked ? "#111820" : "#07070e",
                    border: `1px solid ${filled ? "#4aeecc" : unlocked ? "#1e2e38" : "#111116"}`,
                    opacity: unlocked ? 1 : 0.35,
                    transition: "background 0.2s, border-color 0.2s",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Hand cards */}
        <div style={{ flex: 1, display: "flex", overflow: "visible", position: "relative", zIndex: 10 }}>
          <div style={{
            flex: 1, display: "flex", gap: 22, justifyContent: "center", alignItems: "center",
            padding: "8px 20px 8px", overflow: "visible", marginLeft: -300,
          }}>
            {player.hand.map(card => {
              const isDrawn = drewCardId === card.instanceId;
              return (
                <div key={card.instanceId} style={{ flexShrink: 0, position: "relative", zIndex: 10 }}>
                  <div style={{ transform: "scale(1.25)", transformOrigin: "bottom center" }}>
                    <HandCardView
                      card={card} cardDb={cardDb}
                      energy={player.energy} costReduction={player.costReduction}
                      boardFull={player.board.every(s => s !== null)}
                      isNew={isDrawn}
                      onPlay={() => handlePlayCard(card.instanceId)}
                    />
                  </div>
                </div>
              );
            })}
            {player.hand.length === 0 && (
              <div style={{ color: "#2a2a38", fontSize: 10, letterSpacing: 3, paddingBottom: 8, paddingTop: 8, alignSelf: "center" }}>
                NO CARDS IN HAND
              </div>
            )}
          </div>
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

      {/* ── Attack line SVG overlay ──────────────────────────────────────── */}
      {attackLineStart && battleState.pendingAttackerId && (() => {
        const arrowEnd = mahoragaAiming ? twitchPos : mousePos;
        return (
        <svg style={{
          position: "fixed", inset: 0, width: "100vw", height: "100vh",
          pointerEvents: "none", zIndex: 8000,
        }}>
          <defs>
            <marker id="arrowhead" markerWidth="11" markerHeight="11" refX="7.5" refY="4" orient="auto">
              <path d="M0,0 L0,8 L10,4 z" fill="#ffffff" stroke="#ffffffcc" strokeWidth="0.6" />
            </marker>
            <linearGradient id="attackGrad" gradientUnits="userSpaceOnUse"
              x1={attackLineStart.x} y1={attackLineStart.y} x2={arrowEnd.x} y2={arrowEnd.y}>
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#f2f6ff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
            </linearGradient>
            <filter id="attackGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Soft white under-glow */}
          <line
            x1={attackLineStart.x} y1={attackLineStart.y}
            x2={arrowEnd.x} y2={arrowEnd.y}
            stroke="rgba(255,255,255,0.3)" strokeWidth="8" strokeLinecap="round"
            style={{ filter: "blur(5px)" }}
          />
          {/* Main white line with marching stripe dashes */}
          <line
            x1={attackLineStart.x} y1={attackLineStart.y}
            x2={arrowEnd.x} y2={arrowEnd.y}
            stroke="url(#attackGrad)" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray="14 9"
            markerEnd="url(#arrowhead)"
            filter="url(#attackGlow)"
          >
            <animate attributeName="stroke-dashoffset" from="46" to="0" dur="0.45s" repeatCount="indefinite" />
          </line>
          {/* Thin bright core streak */}
          <line
            x1={attackLineStart.x} y1={attackLineStart.y}
            x2={arrowEnd.x} y2={arrowEnd.y}
            stroke="rgba(255,255,255,0.9)" strokeWidth="1"
            strokeDasharray="3 26"
          >
            <animate attributeName="stroke-dashoffset" from="58" to="0" dur="0.35s" repeatCount="indefinite" />
          </line>
          {/* Origin: pulsing double-ring */}
          <circle cx={attackLineStart.x} cy={attackLineStart.y} r="6" fill="#ffffff" opacity="0.95"
            style={{ filter: "drop-shadow(0 0 8px #ffffff)" }} />
          <circle cx={attackLineStart.x} cy={attackLineStart.y} fill="none" stroke="#ffffff99" strokeWidth="1.5">
            <animate attributeName="r" from="6" to="16" dur="1s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.7" to="0" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
        );
      })()}

      {/* Hit stop — a beat of white-out on heavy impacts */}
      <AnimatePresence>
        {hitStop && (
          <motion.div
            key="hitstop"
            initial={{ opacity: 0.32 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed", inset: 0, zIndex: 70, pointerEvents: "none",
              background: "rgba(255,255,255,0.9)", mixBlendMode: "overlay",
            }}
          />
        )}
      </AnimatePresence>

      {/* Handoff. Covers the board so the next player cannot see the hand of
          whoever just finished their turn. */}
      <AnimatePresence>
        {isOnline && online?.opponentAway != null && !battleState.winner && (
          <motion.div
            key="opp-away"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            style={{
              position: "fixed", top: 52, left: "50%", transform: "translateX(-50%)", zIndex: 8000,
              padding: "8px 18px", borderRadius: 10,
              background: "rgba(10,10,20,0.94)", border: "1px solid #4a4a6a",
              color: "#aab", fontSize: 11, letterSpacing: 2,
            }}
          >
            {online.opponentName} dropped out · waiting up to {online.opponentAway}s
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {handoffTo && !isOnline && !battleState.winner && (
          <motion.div
            key="handoff"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9000,
              background: "rgba(2,2,8,0.97)", backdropFilter: "blur(14px)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 22,
            }}
          >
            <div style={{ fontSize: 9, letterSpacing: 6, color: "#445" }}>PASS THE DEVICE</div>
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}
            >
              <div style={{
                width: 74, height: 74, borderRadius: "50%", overflow: "hidden",
                border: `2px solid ${handoffTo === "P1" ? COLOR.p1 : COLOR.p2}`,
              }}>
                <PlayerIcon icon={handoffTo === "P1" ? p1Icon : p2Icon} size={74} style={{ display: "block" }} />
              </div>
              <div style={{
                fontSize: 26, fontWeight: 900, letterSpacing: 3,
                color: handoffTo === "P1" ? COLOR.p1 : COLOR.p2,
              }}>
                {handoffTo === "P1" ? p1Name : p2Name}
              </div>
              <div style={{ fontSize: 10, color: "#556", letterSpacing: 2 }}>YOUR TURN</div>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
              onClick={() => { setViewer(handoffTo); setHandoffTo(null); }}
              style={{
                marginTop: 6, padding: "12px 44px", borderRadius: 10,
                background: `linear-gradient(135deg, ${COLOR.cursedDeep}, ${COLOR.cursed})`,
                border: "none", color: "#fff",
                fontSize: 12, fontWeight: 900, letterSpacing: 4,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >I'M READY</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {domainFlash && (
          <DomainFlash key="domain" name={domainFlash} onDone={() => setDomainFlash(null)} />
        )}
      </AnimatePresence>

      {/* Spell cast splash — name sweeps up from the center, Hearthstone style */}
      <AnimatePresence>
        {spellFlash && (
          <motion.div
            key={`spell-${spellFlash.key}`}
            initial={{ opacity: 0, scale: 0.6, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.15, y: -26, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            style={{
              position: "fixed", top: "38%", left: 0, right: 0,
              display: "flex", justifyContent: "center",
              pointerEvents: "none", zIndex: 90,
            }}
          >
            <div style={{
              padding: "10px 34px", borderRadius: 14,
              background: "radial-gradient(ellipse at 50% 50%, rgba(90,20,140,0.92), rgba(30,5,60,0.95))",
              border: "1px solid #cc66ff88",
              boxShadow: "0 0 50px #aa44ff66, 0 0 18px #cc66ff44, inset 0 0 24px #7722cc55",
              fontSize: 17, fontWeight: 900, letterSpacing: 4, color: "#eeccff",
              textShadow: "0 0 16px #cc66ff",
            }}>
              ✦ {spellFlash.name.toUpperCase()} ✦
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn banner — sweeps across at every turn change */}
      <AnimatePresence>
        {turnBanner && (
          <motion.div
            key={`turn-${turnBanner.key}`}
            initial={{ opacity: 0, scaleX: 0.1 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            style={{
              position: "fixed", top: "46%", left: 0, right: 0,
              pointerEvents: "none", zIndex: 89,
              display: "flex", justifyContent: "center",
            }}
          >
            <div style={{
              width: "100%",
              padding: "10px 0", textAlign: "center",
              background: turnBanner.pid === "P1"
                ? "linear-gradient(90deg, transparent, rgba(30,80,180,0.55) 30%, rgba(30,80,180,0.55) 70%, transparent)"
                : "linear-gradient(90deg, transparent, rgba(180,40,50,0.55) 30%, rgba(180,40,50,0.55) 70%, transparent)",
              borderTop: `1px solid ${turnBanner.pid === "P1" ? "#4a9eff66" : "#ff666666"}`,
              borderBottom: `1px solid ${turnBanner.pid === "P1" ? "#4a9eff66" : "#ff666666"}`,
              fontSize: 19, fontWeight: 900, letterSpacing: 8,
              color: turnBanner.pid === "P1" ? "#aaccff" : "#ffbbbb",
              textShadow: `0 0 20px ${turnBanner.pid === "P1" ? "#4a9eff" : "#ff5555"}`,
            }}>
              ⚔ {(turnBanner.pid === "P1" ? p1Name : p2Name).toUpperCase()}'S TURN ⚔
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gameOverShown && battleState.winner && (
          <GameOverOverlay key="gameover" winnerName={winnerName} winnerIcon={winnerIcon} onDone={() => onGameOver(battleState.winner!, battleState.turn)} />
        )}
      </AnimatePresence>
    </motion.div>
    </div>
    </ErrorBoundary>
  );
}
